import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchPage, pageDrift } from "./check-website-plugins.mjs";

const skillsOf = new Map([
  ["hp-a", ["one", "two"]],
  ["hp-b", ["three"]],
]);
const page = { url: "https://site/p", skillsOf, marketplaceName: "mk", expected: ["hp-a", "hp-b"], requireInstall: true };

const html = ({ markers = ["hp-a/one", "hp-a/two", "hp-b/three"], text = "hp-a@mk hp-b@mk /hp-a:one" } = {}) =>
  `${markers.map((m) => `<div data-skill="${m}"></div>`).join("")}<pre>${text}</pre>`;

describe("pageDrift", () => {
  it("passes a page that lists every skill and installs every plugin", () => {
    assert.deepEqual(pageDrift(html(), page), []);
  });

  it("names a skill folder the page doesn't list", () => {
    assert.match(pageDrift(html({ markers: ["hp-a/one", "hp-b/three"] }), page).join("\n"), /doesn't list hp-a\/two/);
  });

  it("names a listed skill this repo doesn't ship", () => {
    const markers = ["hp-a/one", "hp-a/two", "hp-b/three", "hp-a/gone"];
    assert.match(pageDrift(html({ markers }), page).join("\n"), /lists hp-a\/gone, which this repo doesn't ship/);
  });

  it("rejects an install command for a plugin the marketplace doesn't list", () => {
    assert.match(pageDrift(html({ text: "hp-a@mk hp-b@mk old-name@mk" }), page).join("\n"), /installs "old-name@mk"/);
  });

  it("rejects an invocation of a skill under a plugin that doesn't ship it", () => {
    assert.match(pageDrift(html({ text: "hp-a@mk hp-b@mk /old-name:one" }), page).join("\n"), /invokes "\/old-name:one"/);
  });

  it("requires each plugin's install command on a page that asks for it", () => {
    assert.match(pageDrift(html({ text: "hp-a@mk" }), page).join("\n"), /no install command for hp-b@mk/);
    assert.deepEqual(pageDrift(html({ text: "hp-a@mk" }), { ...page, requireInstall: false }), []);
  });

  it("reports a page with no markers once, not as every skill missing", () => {
    const errors = pageDrift("<html>Log in to Vercel</html>", page);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /lists no skills at all/);
  });

  it("ignores an escaped placeholder in a slash-command shape", () => {
    assert.deepEqual(pageDrift(html({ text: "hp-a@mk hp-b@mk /hp-a:&lt;skill&gt;" }), page), []);
  });
});

const respond = (status, { body = "", redirectedTo } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  redirected: Boolean(redirectedTo),
  url: redirectedTo ?? "https://site/p",
  text: async () => body,
});

const sequence = (...answers) => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const answer = answers[Math.min(calls.length, answers.length) - 1];
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetchImpl, calls };
};

describe("fetchPage", () => {
  const options = (fetchImpl) => ({ fetchImpl, retryDelayMs: 0 });

  it("retries a 5xx answer and returns the page that follows", async () => {
    const { fetchImpl, calls } = sequence(respond(503), respond(200, { body: "ok" }));
    assert.equal(await fetchPage("https://site/p", options(fetchImpl)), "ok");
    assert.equal(calls.length, 2);
  });

  it("retries a network error", async () => {
    const { fetchImpl, calls } = sequence(new Error("ECONNRESET"), respond(200, { body: "ok" }));
    assert.equal(await fetchPage("https://site/p", options(fetchImpl)), "ok");
    assert.equal(calls.length, 2);
  });

  it("gives up after the last attempt", async () => {
    const { fetchImpl, calls } = sequence(respond(502));
    await assert.rejects(fetchPage("https://site/p", options(fetchImpl)), /HTTP 502/);
    assert.equal(calls.length, 3);
  });

  it("does not retry a 404", async () => {
    const { fetchImpl, calls } = sequence(respond(404));
    await assert.rejects(fetchPage("https://site/p", options(fetchImpl)), /HTTP 404/);
    assert.equal(calls.length, 1);
  });

  it("rejects a redirect to another origin, such as a login wall", async () => {
    const { fetchImpl, calls } = sequence(respond(200, { body: "login", redirectedTo: "https://vercel.com/login" }));
    await assert.rejects(fetchPage("https://site/p", options(fetchImpl)), /redirected to https:\/\/vercel.com\/login/);
    assert.equal(calls.length, 1);
  });
});
