import test from "node:test";
import assert from "node:assert/strict";
import { crmStatusLabel, crmMediaType } from "./orderPresentation.js";

test("displays the new order status in Russian while preserving unknown labels", () => {
  assert.equal(crmStatusLabel("new"), "Новая");
  assert.equal(crmStatusLabel("New"), "Новая");
  assert.equal(crmStatusLabel("технолог"), "технолог");
  assert.equal(crmStatusLabel("custom status"), "custom status");
});

test("recognizes common video extensions for order attachments", () => {
  for (const key of ["orders/a/clip.mp4", "orders/a/clip.webm", "clip.MOV", "clip.m4v"]) {
    assert.equal(crmMediaType(key), "video");
  }
  assert.equal(crmMediaType("orders/a/photo.jpeg"), "image");
  assert.equal(crmMediaType("orders/a/photo.png"), "image");
});
