// Loads a built game into jsdom and drives it through real DOM events.
//
// The games are one IIFE with nothing exported, so tests can only observe what
// a player could: rendered text, classes, stored values and what TTS was asked
// to say. jsdom lacks a few browser APIs the games use; they are supplied here
// from Node before the page's script runs.

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sources = new Map();

function source(file) {
  if (!sources.has(file)) sources.set(file, readFileSync(path.join(ROOT, file), "utf8"));
  return sources.get(file);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(check, label = "condition", ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) return;
    await sleep(20);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

/** A voice as the Web Speech API reports it. */
export const voice = (name, lang, extra = {}) => ({
  name, lang, voiceURI: name, localService: true, default: false, ...extra,
});

/**
 * @param {object}   [opts]
 * @param {string}   [opts.file]     built HTML file, relative to the repo root
 * @param {object}   [opts.storage]  localStorage entries to seed, values JSON-encoded
 * @param {object[]} [opts.voices]   when given, install a recording speechSynthesis
 *                                   stub offering these voices; when omitted the
 *                                   page sees no speech support at all
 */
export function boot({ file = "hangman.html", storage = {}, voices } = {}) {
  const spoken = [];
  const speech = { cancels: 0, voicesChanged: null };

  const dom = new JSDOM(source(file), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    beforeParse(w) {
      w.DecompressionStream = DecompressionStream;
      w.Blob = Blob;
      w.Response = Response;
      w.atob = atob;
      w.TextDecoder = TextDecoder;
      for (const [key, value] of Object.entries(storage)) {
        w.localStorage.setItem(key, JSON.stringify(value));
      }
      if (voices) {
        w.SpeechSynthesisUtterance = class {
          constructor(text) { this.text = text; }
        };
        w.speechSynthesis = {
          getVoices: () => voices,
          speak: (u) => spoken.push({ text: u.text, pitch: u.pitch, rate: u.rate, voice: u.voice?.name }),
          cancel: () => { speech.cancels++; },
          addEventListener: (type, fn) => { if (type === "voiceschanged") speech.voicesChanged = fn; },
        };
      }
    },
  });

  const { window } = dom;
  const doc = window.document;
  const $ = (id) => doc.getElementById(id);

  const game = {
    window, doc, $, spoken, speech,

    /** Dispatch a keydown the way a physical keyboard would; returns the event. */
    key(k) {
      const event = new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
      doc.dispatchEvent(event);
      return event;
    },
    type(text) { for (const ch of text) game.key(ch); },
    fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); },

    answer: () => $("answer").textContent,
    lives: () => $("lives").textContent,
    inGame: () => $("game").classList.contains("active"),
    roundOver: () => !$("round-end").hidden,
    keyButton: (letter) => $("keys").querySelector(`[data-letter="${letter}"]`),
    stored: (key) => JSON.parse(window.localStorage.getItem(key)),

    /** Submit a word bank and wait for the loading screen's verdict. */
    async load(bank) {
      if (game.inGame()) $("quit").click();
      if (!$("setup").classList.contains("active")) $("back").click();
      $("bank-input").value = bank;
      $("start").click();
      await until(() => !$("load-result").hidden, `loading "${bank}"`);
    },

    /** Load a bank and start playing its first round. */
    async play(bank) {
      await game.load(bank);
      $("play").click();
      await until(() => game.inGame(), "game screen");
    },

    close() { window.close(); },
  };
  return game;
}
