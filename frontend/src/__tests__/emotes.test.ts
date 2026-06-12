import { describe, expect, it } from "vitest";
import { getEmoteUrl, registerEmotes } from "@/lib/emotes";

describe("emote registry", () => {
  it("resolves backend-provided platform emotes", () => {
    const url = "https://static-cdn.jtvnw.net/emoticons/v2/123/default/dark/2.0";

    expect(registerEmotes([{ code: "UnitTestTwitchEmote", url }])).toBe(true);
    expect(getEmoteUrl("UnitTestTwitchEmote")).toBe(url);
  });

  it("resolves colon-wrapped Kick-style emote tokens", () => {
    const url = "https://files.kick.com/emotes/unit-test.webp";

    expect(registerEmotes([{ code: "UnitTestKickEmote", url }])).toBe(true);
    expect(getEmoteUrl(":UnitTestKickEmote:")).toBe(url);
  });
});
