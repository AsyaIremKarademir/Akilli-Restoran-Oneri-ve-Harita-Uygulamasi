import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as chat } from "./chat/route";
import { GET as places } from "./places/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/places", () => {
  it("geçersiz koordinatta 400 dönmeli", async () => {
    const res = await places(new NextRequest("http://localhost/api/places?lat=abc&lon=1"));
    expect(res.status).toBe(400);
  });

  it("Overpass yanıtını normalize edip önbelleğe almalı", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        elements: [{ type: "node", id: 7, lat: 10, lon: 10, tags: { amenity: "cafe", name: "Kafe" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "http://localhost/api/places?lat=10&lon=10&radius=1000";
    const first = await places(new NextRequest(url));
    const body = await first.json();
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(body.places).toHaveLength(1);
    expect(body.places[0]).toMatchObject({ id: "node/7", type: "cafe" });

    const second = await places(new NextRequest(url));
    expect(second.headers.get("X-Cache")).toBe("HIT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bir sunucu hata verirse sıradaki sunucuya geçmeli", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 502 }))
      .mockResolvedValue(Response.json({ elements: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await places(new NextRequest("http://localhost/api/places?lat=20&lon=20&radius=500"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/chat", () => {
  const body = {
    locale: "tr",
    messages: [{ role: "user", content: "pizza" }],
    places: [
      {
        id: "node/1",
        name: "Pizzacı",
        type: "restaurant",
        categories: ["pizza"],
        cuisines: ["pizza"],
        distance: 200,
        priceLevel: 2,
        score: 70,
      },
    ],
    preferences: { cuisines: [], maxDistance: 1500, priceRange: [1, 3] },
  };
  const post = (b) => chat(new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify(b) }));

  it("geçersiz istekte 400 dönmeli", async () => {
    expect((await post({ messages: [] })).status).toBe(400);
  });

  it("API anahtarı yoksa kural tabanlı moda geçmeli", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await (await post(body)).json();
    expect(res).toMatchObject({ mode: "rules", placeIds: ["node/1"] });
  });

  it("Gemini yanıtındaki bilinmeyen mekan id'lerini elemeli", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ reply: "Pizzacı'yı dene!", placeIds: ["node/1", "node/999"] }) }],
              },
            },
          ],
        }),
      ),
    );
    const res = await (await post(body)).json();
    expect(res).toEqual({ mode: "ai", reply: "Pizzacı'yı dene!", placeIds: ["node/1"] });
  });

  it("kotası dolan modeli tekrar denemeden yedek modele geçmeli ve sonraki isteklerde atlamalı", async () => {
    vi.resetModules();
    const { POST: freshChat } = await import("./chat/route");
    const send = (b) => freshChat(new NextRequest("http://localhost/api/chat", { method: "POST", body: JSON.stringify(b) }));
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const ok = () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "Pizzacı!", placeIds: ["node/1"] }) }] } }],
      });
    const fetchMock = vi.fn(async (url) =>
      url.includes("-lite")
        ? ok()
        : Response.json({ error: { details: [{ retryDelay: "3600s" }] } }, { status: 429 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect((await (await send(body)).json()).mode).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await (await send(body)).json()).mode).toBe("ai");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("-lite");
  });

  it("Gemini hata verirse kural tabanlı moda düşmeli", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await (await post(body)).json();
    expect(res.mode).toBe("rules");
  });
});
