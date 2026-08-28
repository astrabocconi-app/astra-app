import assert from "node:assert/strict";
import test from "node:test";
import { filterMaterialsForAcademicProfile } from "./materials.ts";

const materials = [
  {
    year: "First Year",
    count: 3,
    subjects: [
      {
        subject: "BIEM",
        items: [
          {
            id: "biem-1",
            title: "BIEM notes",
            url: "https://example.com/biem.pdf",
            semester: "1",
            examType: null,
          },
        ],
      },
      {
        subject: "CLEAM",
        items: [
          {
            id: "cleam-1",
            title: "CLEAM notes",
            url: "https://example.com/cleam.pdf",
            semester: "1",
            examType: null,
          },
          {
            id: "cleam-2",
            title: "More CLEAM notes",
            url: "https://example.com/cleam-2.pdf",
            semester: "2",
            examType: null,
          },
        ],
      },
    ],
  },
  {
    year: "Second Year",
    count: 1,
    subjects: [
      {
        subject: "BIEM",
        items: [
          {
            id: "biem-2",
            title: "Second-year BIEM notes",
            url: "https://example.com/biem-2.pdf",
            semester: "1",
            examType: null,
          },
        ],
      },
    ],
  },
];

test("materials are filtered by the saved programme and study year", () => {
  assert.deepEqual(filterMaterialsForAcademicProfile(materials, "BIEM", 1), [
    {
      year: "First Year",
      count: 1,
      subjects: [materials[0].subjects[0]],
    },
  ]);
});

test("materials return empty for unsupported selections", () => {
  assert.deepEqual(filterMaterialsForAcademicProfile(materials, "BIEF", 1), []);
  assert.deepEqual(filterMaterialsForAcademicProfile(materials, "BIEM", 6), []);
});

test("materials accept official compound programme labels", () => {
  const compound = structuredClone(materials);
  compound[0].subjects[0].subject = "BESS-CLES";
  assert.equal(filterMaterialsForAcademicProfile(compound, "BESS", 1)[0].count, 1);
});
