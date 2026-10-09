import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addDays,
  campusRooms,
  collectRooms,
  computeRooms,
  decodeEntities,
  looksLikeTimetable,
  parseRoomCell,
  parseTime,
  parseTimetableHtml,
  resolveDate,
  romeNow,
  sortRooms,
} from "./classrooms-core.ts";

const html = readFileSync(new URL("./__fixtures__/lista_orario.html", import.meta.url), "utf8");
const t = (s) => parseTime(s);

const room = (name, building = "Sarfatti 25", floor = "1") => ({
  key: `${building.toLowerCase()}|${name.toLowerCase()}`,
  name,
  building,
  floor,
});
const slot = (r, start, end, extra = {}) => ({
  date: "2026-10-09",
  start: t(start),
  end: t(end),
  type: "Lezione",
  rooms: [r],
  studyRoom: false,
  ...extra,
});

// ── Parsing the real page ───────────────────────────────────────────────────

test("the real markup parses into assignments, skipping the header row", () => {
  assert.equal(looksLikeTimetable(html), true);
  const rows = parseTimetableHtml(html);
  assert.equal(rows.length, 13);
  const first = rows[0];
  assert.equal(first.date, "2026-10-09");
  assert.equal(first.start, t("14:30"));
  assert.equal(first.end, t("16:00"));
  assert.equal(first.type, "Lezione");
  assert.deepEqual(first.rooms.map((r) => [r.name, r.floor, r.building]), [["Aula 44", "4", "Sarfatti 25"]]);
});

test("a page that is not the assignment list is rejected, not read as empty", () => {
  assert.equal(looksLikeTimetable("<html><body><h1>Manutenzione</h1></body></html>"), false);
  assert.equal(looksLikeTimetable("<table><tr><th>Data</th></tr></table>"), false);
});

test("multi-room cells, lowercase 'aula', negative floors and basements", () => {
  const rows = parseTimetableHtml(html);
  const multi = rows.find((r) => r.rooms.length === 2);
  assert.deepEqual(multi.rooms.map((r) => r.name), ["Aula 202", "Aula 23"]);
  const roentgen = rows.find((r) => r.rooms[0]?.building === "Roentgen");
  assert.equal(roentgen.rooms[0].name, "Aula AS04"); // "aula AS04" in the source
  assert.equal(roentgen.rooms[0].floor, "-2");
  const basement = rows.find((r) => r.rooms[0]?.floor === "seminterrato");
  assert.equal(basement.rooms[0].name, "Aula INFOU01");
});

test("rooms that are not campus rooms never enter the list", () => {
  const rows = parseTimetableHtml(html);
  const exec = rows.find((r) => r.type === "Lezione" && r.rooms.length === 0);
  assert.ok(exec, "C.M0.03 / Classroom 7 / empty cells parse to no rooms");
  assert.deepEqual(parseRoomCell(["C.M0.03"]), []);
  assert.deepEqual(parseRoomCell(["Classroom 7"]), []);
  assert.deepEqual(parseRoomCell(["Fuori sede"]), []);
  assert.deepEqual(parseRoomCell([""]), []);
});

test("only the generic 'Aule studio' slot is an open study room", () => {
  const rows = parseTimetableHtml(html);
  const study = rows.filter((r) => r.studyRoom);
  assert.ok(study.length >= 2);
  assert.ok(study.every((r) => /^attiv/i.test(r.type)));
  // the programme-only "MAFINRISK - Aula studio" is busy for everyone else
  const mafinrisk = rows.find((r) => r.type.startsWith("Attiv") && !r.studyRoom && r.rooms[0]?.name === "Aula 44");
  assert.ok(mafinrisk);
});

test("exams count as slots too", () => {
  const rows = parseTimetableHtml(html);
  assert.ok(rows.some((r) => r.type.startsWith("Esame")));
});

test("entities, time and room cell helpers", () => {
  assert.equal(decodeEntities("EMBA&nbsp;WE &amp; CALABR&#039;O &agrave; &#x41;"), "EMBA WE & CALABR'O à A");
  assert.equal(decodeEntities("&unknown; stays"), "&unknown; stays");
  assert.equal(parseTime("8:05"), 485);
  assert.equal(parseTime("23:59"), 1439);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("09:60"), null);
  assert.equal(parseRoomCell(["Aula 12, Piano 1, Sarfatti 25 |"])[0].building, "Sarfatti 25");
  assert.equal(parseRoomCell(["Aula InfoAS1, Piano - 1, Roentgen"])[0].floor, "-1");
});

// ── Availability ────────────────────────────────────────────────────────────

const A = room("Aula 12");
const B = room("Aula 13");

test("a slot occupies [start, end): free again exactly at its end", () => {
  const day = [slot(A, "10:30", "12:00")];
  assert.equal(computeRooms([A], day, t("10:29"))[0].status, "free");
  assert.equal(computeRooms([A], day, t("10:30"))[0].status, "occupied");
  assert.equal(computeRooms([A], day, t("11:59"))[0].status, "occupied");
  assert.equal(computeRooms([A], day, t("12:00"))[0].status, "free");
});

test("a slot that started before the asked time still counts (the page's hour filter would drop it)", () => {
  const day = [slot(A, "13:00", "15:00")];
  const [r] = computeRooms([A], day, t("14:00"));
  assert.equal(r.status, "occupied");
  assert.equal(r.occupiedUntil, "15:00");
});

test("back-to-back slots are one occupied run; a gap is not", () => {
  const day = [slot(A, "08:45", "10:15"), slot(A, "10:15", "11:45"), slot(A, "12:00", "13:30")];
  assert.equal(computeRooms([A], day, t("09:00"))[0].occupiedUntil, "11:45");
  const [gap] = computeRooms([A], day, t("11:50"));
  assert.equal(gap.status, "free");
  assert.equal(gap.freeUntil, "12:00");
});

test("free rooms report when the next slot starts, or nothing for the rest of the day", () => {
  const day = [slot(A, "14:00", "15:30")];
  assert.equal(computeRooms([A], day, t("09:00"))[0].freeUntil, "14:00");
  const after = computeRooms([A], day, t("16:00"))[0];
  assert.equal(after.status, "free");
  assert.equal(after.freeUntil, undefined);
  assert.equal(computeRooms([B], day, t("09:00"))[0].freeUntil, undefined); // never booked
});

test("an open study slot makes the room free AND a study room until it ends", () => {
  const day = [slot(A, "08:30", "11:45", { type: "Attivita'", studyRoom: true })];
  const [r] = computeRooms([A], day, t("09:00"));
  assert.equal(r.status, "free");
  assert.equal(r.isStudyRoom, true);
  assert.equal(r.studyUntil, "11:45");
  const [later] = computeRooms([A], day, t("12:00"));
  assert.equal(later.isStudyRoom, undefined);
});

test("a lesson beats a study slot, and a study slot never runs past the next lesson", () => {
  const study = slot(A, "08:30", "18:00", { type: "Attivita'", studyRoom: true });
  const lesson = slot(A, "13:00", "14:30");
  assert.equal(computeRooms([A], [study, lesson], t("13:30"))[0].status, "occupied");
  const [morning] = computeRooms([A], [study, lesson], t("10:00"));
  assert.equal(morning.isStudyRoom, true);
  assert.equal(morning.freeUntil, "13:00");
  assert.equal(morning.studyUntil, "13:00");
});

test("a program-only study slot is busy", () => {
  const day = [slot(A, "12:00", "14:30", { type: "Attivita'", studyRoom: false })];
  assert.equal(computeRooms([A], day, t("13:00"))[0].status, "occupied");
});

test("a multi-room slot occupies every room it names", () => {
  const day = [{ ...slot(A, "10:00", "11:00"), rooms: [A, B] }];
  const rooms = computeRooms([A, B], day, t("10:30"));
  assert.deepEqual(rooms.map((r) => r.status), ["occupied", "occupied"]);
});

// ── Room list ───────────────────────────────────────────────────────────────

test("buildings with fewer than three rooms are not campus buildings", () => {
  const rows = [
    slot(room("Aula 1"), "09:00", "10:00"),
    slot(room("Aula 2"), "09:00", "10:00"),
    slot(room("Aula 3"), "09:00", "10:00"),
    slot(room("Sala Unica", "MEO - Executive"), "09:00", "10:00"),
  ];
  const campus = campusRooms(collectRooms(rows));
  assert.equal(campus.length, 3);
  assert.ok(campus.every((r) => r.building === "Sarfatti 25"));
});

test("rooms sort by building, then naturally by name", () => {
  const sorted = sortRooms([
    { name: "Aula 12", building: "Sarfatti 25" },
    { name: "Aula N03", building: "Sraffa 13" },
    { name: "Aula 2", building: "Sarfatti 25" },
    { name: "3-D3-SR01", building: "Roentgen" },
    { name: "Aula A", building: "Sarfatti 25" },
  ]);
  assert.deepEqual(sorted.map((r) => r.name), ["Aula 2", "Aula 12", "Aula A", "Aula N03", "3-D3-SR01"]);
});

// ── Dates (Rome time, whatever the server clock says) ───────────────────────

test("Rome date and minute across summer, winter and the DST switch", () => {
  assert.deepEqual(romeNow(new Date("2026-07-01T22:30:00Z")), { date: "2026-07-02", minutes: 30 });
  assert.deepEqual(romeNow(new Date("2026-12-10T22:30:00Z")), { date: "2026-12-10", minutes: 23 * 60 + 30 });
  assert.deepEqual(romeNow(new Date("2026-12-10T23:30:00Z")), { date: "2026-12-11", minutes: 30 });
  // 2026-10-25 01:00 UTC: CEST (+2) becomes CET (+1)
  assert.deepEqual(romeNow(new Date("2026-10-25T00:30:00Z")), { date: "2026-10-25", minutes: 2 * 60 + 30 });
  assert.deepEqual(romeNow(new Date("2026-10-25T01:30:00Z")), { date: "2026-10-25", minutes: 2 * 60 + 30 });
});

test("day aliases, explicit dates and invalid input", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(resolveDate({}, "2026-10-09"), "2026-10-09");
  assert.equal(resolveDate({ day: "tomorrow" }, "2026-10-09"), "2026-10-10");
  assert.equal(resolveDate({ day: "day-after" }, "2026-10-31"), "2026-11-02");
  assert.equal(resolveDate({ day: "tomorrow", date: "2026-10-20" }, "2026-10-09"), "2026-10-20");
  assert.equal(resolveDate({ day: "yesterday" }, "2026-10-09"), null);
  assert.equal(resolveDate({ date: "2026-02-30" }, "2026-10-09"), null);
  assert.equal(resolveDate({ date: "10/10/2026" }, "2026-10-09"), null);
  assert.equal(resolveDate({ day: "2026-10-14" }, "2026-10-09"), "2026-10-14"); // the app sends dates through `day` too
  assert.equal(resolveDate({ day: "2026-13-01" }, "2026-10-09"), null);
});
