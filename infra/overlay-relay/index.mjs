import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DeleteItemCommand, DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME;
const MAX_EVENT_BYTES = 120_000;
const TTL_SECONDS = 60 * 60 * 6;
const ddb = new DynamoDBClient({});

const response = (statusCode, body = "ok") => ({ statusCode, body: typeof body === "string" ? body : JSON.stringify(body) });
const text = (value, fallback, max) => String(value ?? fallback).replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, max) || fallback;

function endpoint(event) {
  const { domainName, stage } = event.requestContext;
  return `https://${domainName}/${stage}`;
}

function cleanRoom(room) {
  return text(room, "market-bubble-live", 80);
}

function parseFrame(body) {
  try {
    const raw = JSON.parse(body || "{}");
    if (raw?.type === "join") return { type: "join", room: cleanRoom(raw.room) };
    if (raw?.type === "action" && raw.event && JSON.stringify(raw.event).length <= MAX_EVENT_BYTES) {
      return { type: "action", room: cleanRoom(raw.event.room), event: raw.event };
    }
  } catch {
    return null;
  }
  return null;
}

async function deleteConnection(connectionId, room = "unknown") {
  if (!TABLE_NAME) return;
  await ddb.send(new DeleteItemCommand({
    TableName: TABLE_NAME,
    Key: { room: { S: room }, connectionId: { S: connectionId } },
  })).catch(() => undefined);
}

async function joinRoom(connectionId, room) {
  if (!TABLE_NAME) throw new Error("TABLE_NAME missing");
  await ddb.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      room: { S: room },
      connectionId: { S: connectionId },
      ttl: { N: String(Math.floor(Date.now() / 1000) + TTL_SECONDS) },
    },
  }));
}

async function roomConnections(room) {
  if (!TABLE_NAME) return [];
  const out = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "room = :room",
    ExpressionAttributeValues: { ":room": { S: room } },
    ProjectionExpression: "connectionId",
    Limit: 250,
  }));
  return (out.Items ?? []).map((item) => item.connectionId?.S).filter(Boolean);
}

async function broadcast(event, room, payload) {
  const client = new ApiGatewayManagementApiClient({ endpoint: endpoint(event) });
  const data = new TextEncoder().encode(JSON.stringify({ event: payload }));
  const connections = await roomConnections(room);
  await Promise.all(connections.map(async (connectionId) => {
    try {
      await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
    } catch (err) {
      if (err instanceof GoneException || err?.name === "GoneException") {
        await deleteConnection(connectionId, room);
      }
    }
  }));
}

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const route = event.requestContext.routeKey;

  if (route === "$connect") return response(200);
  if (route === "$disconnect") return response(200);

  const frame = parseFrame(event.body);
  if (!frame) return response(400, { error: "bad frame" });

  if (frame.type === "join") {
    await joinRoom(connectionId, frame.room);
    return response(200);
  }

  await broadcast(event, frame.room, frame.event);
  return response(200);
};
