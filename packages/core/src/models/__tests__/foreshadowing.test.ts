import { describe, expect, it } from "vitest";
import {
  ForeshadowingSchema,
  ForeshadowingCreateSchema,
  ForeshadowingUpdateSchema,
  ForeshadowingTypeEnum,
  ForeshadowingStatusEnum,
  checkForeshadowingForget,
  findForgottenForeshadowing,
  type Foreshadowing,
} from "../foreshadowing.js";

describe("ForeshadowingSchema (Issue #84)", () => {
  describe("valid entries", () => {
    it("accepts a minimal foreshadowing entry with defaults", () => {
      const parsed = ForeshadowingSchema.parse({
        id: "foreshadow-001",
        title: "神秘戒指",
        bookId: "test-book",
      });
      expect(parsed.id).toBe("foreshadow-001");
      expect(parsed.title).toBe("神秘戒指");
      expect(parsed.description).toBe("");
      expect(parsed.type).toBe("情节伏笔");
      expect(parsed.status).toBe("active");
      expect(parsed.createdChapter).toBe(0);
      expect(parsed.lastMentionedChapter).toBe(0);
      expect(parsed.expectedPayoffChapter).toBeNull();
      expect(parsed.payoffChapter).toBeNull();
      expect(parsed.relatedElements).toEqual([]);
      expect(parsed.notes).toBe("");
    });

    it("accepts a full foreshadowing entry", () => {
      const raw: Foreshadowing = {
        id: "foreshadow-002",
        bookId: "test-book",
        title: "钥匙之谜",
        description: "一把古老的钥匙出现在第一章",
        type: "物品伏笔",
        createdChapter: 1,
        expectedPayoffChapter: 15,
        status: "active",
        payoffChapter: null,
        lastMentionedChapter: 3,
        relatedElements: ["char-001", "loc-002"],
        notes: "暗示这能打开某个神秘宝箱",
      };
      const parsed = ForeshadowingSchema.parse(raw);
      expect(parsed.type).toBe("物品伏笔");
      expect(parsed.expectedPayoffChapter).toBe(15);
      expect(parsed.lastMentionedChapter).toBe(3);
    });

    it("accepts paid_off status with payoff chapter", () => {
      const parsed = ForeshadowingSchema.parse({
        id: "foreshadow-003",
        title: "预言",
        bookId: "test-book",
        status: "paid_off",
        payoffChapter: 20,
      });
      expect(parsed.status).toBe("paid_off");
      expect(parsed.payoffChapter).toBe(20);
    });

    it("accepts abandoned status", () => {
      const parsed = ForeshadowingSchema.parse({
        id: "foreshadow-004",
        title: "放弃的线索",
        bookId: "test-book",
        status: "abandoned",
      });
      expect(parsed.status).toBe("abandoned");
    });
  });

  describe("rejects invalid entries", () => {
    it("rejects empty id", () => {
      expect(() => ForeshadowingSchema.parse({ id: "", title: "test" })).toThrow();
    });

    it("rejects empty title", () => {
      expect(() => ForeshadowingSchema.parse({ id: "test", title: "" })).toThrow();
    });

    it("rejects unknown type", () => {
      expect(() =>
        ForeshadowingSchema.parse({ id: "test", title: "t", type: "unknown" }),
      ).toThrow();
    });

    it("rejects unknown status", () => {
      expect(() =>
        ForeshadowingSchema.parse({ id: "test", title: "t", status: "unknown" }),
      ).toThrow();
    });
  });

  describe("sub-schemas", () => {
    it("ForeshadowingCreateSchema requires id and title", () => {
      const ok = ForeshadowingCreateSchema.parse({
        id: "f-001",
        title: "A foreshadow",
        bookId: "test-book",
      });
      expect(ok.id).toBe("f-001");
      expect(ok.title).toBe("A foreshadow");
    });

    it("ForeshadowingUpdateSchema allows partial update without id", () => {
      const parsed = ForeshadowingUpdateSchema.parse({
        status: "paid_off",
        payoffChapter: 10,
      });
      expect(parsed.status).toBe("paid_off");
      expect(parsed.payoffChapter).toBe(10);
    });
  });

  describe("ForeshadowingTypeEnum", () => {
    it("has 4 types", () => {
      expect(ForeshadowingTypeEnum.options).toEqual([
        "情节伏笔",
        "角色伏笔",
        "物品伏笔",
        "设定伏笔",
      ]);
    });
  });

  describe("ForeshadowingStatusEnum", () => {
    it("has 3 statuses", () => {
      expect(ForeshadowingStatusEnum.options).toEqual(["active", "paid_off", "abandoned"]);
    });
  });
});

describe("forget detection", () => {
  it("returns not forgotten for active entry mentioned recently", () => {
    const entry: Foreshadowing = {
      id: "f-001",
      title: "Test",
      description: "",
      type: "情节伏笔",
      bookId: "test-book",
      createdChapter: 1,
      expectedPayoffChapter: null,
      status: "active",
      payoffChapter: null,
      lastMentionedChapter: 8,
      relatedElements: [],
      notes: "",
    };
    const result = checkForeshadowingForget(entry, 10, 10);
    expect(result.isForgotten).toBe(false);
    expect(result.chaptersSinceMention).toBe(2);
  });

  it("returns forgotten for active entry not mentioned for threshold chapters", () => {
    const entry: Foreshadowing = {
      id: "f-002",
      title: "Forgotten",
      description: "",
      type: "情节伏笔",
      bookId: "test-book",
      createdChapter: 1,
      expectedPayoffChapter: null,
      status: "active",
      payoffChapter: null,
      lastMentionedChapter: 1,
      relatedElements: [],
      notes: "",
    };
    const result = checkForeshadowingForget(entry, 15, 10);
    expect(result.isForgotten).toBe(true);
    expect(result.chaptersSinceMention).toBe(14);
  });

  it("returns not forgotten for paid_off entry even if old", () => {
    const entry: Foreshadowing = {
      id: "f-003",
      title: "Paid",
      description: "",
      type: "情节伏笔",
      bookId: "test-book",
      createdChapter: 1,
      expectedPayoffChapter: null,
      status: "paid_off",
      payoffChapter: 5,
      lastMentionedChapter: 1,
      relatedElements: [],
      notes: "",
    };
    const result = checkForeshadowingForget(entry, 20, 10);
    expect(result.isForgotten).toBe(false);
  });

  it("findForgottenForeshadowing returns only forgotten entries", () => {
    const entries: Foreshadowing[] = [
      {
        id: "f1", title: "Recent", description: "", type: "情节伏笔",
        bookId: "test-book",
        createdChapter: 1, expectedPayoffChapter: null, status: "active",
        payoffChapter: null, lastMentionedChapter: 9, relatedElements: [], notes: "",
      },
      {
        id: "f2", title: "Old", description: "", type: "设定伏笔",
        bookId: "test-book",
        createdChapter: 1, expectedPayoffChapter: null, status: "active",
        payoffChapter: null, lastMentionedChapter: 1, relatedElements: [], notes: "",
      },
      {
        id: "f3", title: "Paid", description: "", type: "角色伏笔",
        bookId: "test-book",
        createdChapter: 1, expectedPayoffChapter: null, status: "paid_off",
        payoffChapter: 10, lastMentionedChapter: 1, relatedElements: [], notes: "",
      },
    ];
    const forgotten = findForgottenForeshadowing(entries, 15, 10);
    expect(forgotten).toHaveLength(1);
    expect(forgotten[0].foreshadowingId).toBe("f2");
  });
});
