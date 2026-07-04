"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/* =============================================
   Types
   ============================================= */
interface DayActivity {
  /** 0-4 热力等级 */
  level: number;
  /** 当日写作字数 */
  wordCount: number;
  /** 日期时间戳 (ms) */
  timestamp: number;
}

interface StreakSettings {
  /** 本周已使用的冻结次数 */
  freezeUsedThisWeek: number;
  /** 冻结可用总次数（默认每周 1 次） */
  freezeTotalPerWeek: number;
  /** 上次冻结的周标识 "YYYY-Www" */
  lastFreezeWeek: string | null;
}

interface MilestoneDef {
  days: number;
  label: string;
  icon: React.ReactNode;
}

/* =============================================
   Constants
   ============================================= */
const STORAGE_KEY = "inkos-writing-activity";
const SETTINGS_KEY = "inkos-streak-settings";

/** 热力色阶 (5 级) — 与原型一致 */
const HEAT_COLORS = [
  "bg-[#FDF6F0] border border-[#E8DFD0]/40",
  "bg-[#F5EBE0]",
  "bg-[#E8D0C0]",
  "bg-[#D4A090]",
  "bg-[#8B3A3A]",
];

/** 热力色阶映射类名 (Tailwind arbitrary values) */
const HEAT_LEVEL_CLASS = [
  "heat-lv0",
  "heat-lv1",
  "heat-lv2",
  "heat-lv3",
  "heat-lv4",
];

/** 里程碑定义 */
const MILESTONES: MilestoneDef[] = [
  {
    days: 7,
    label: "7天",
    icon: <FireMiniIcon />,
  },
  {
    days: 30,
    label: "30天",
    icon: <TrophyMiniIcon />,
  },
  {
    days: 100,
    label: "100天",
    icon: <StarMiniIcon />,
  },
  {
    days: 365,
    label: "365天",
    icon: <CrownMiniIcon />,
  },
];

/** 每周默认冻结次数 */
const DEFAULT_FREEZE_PER_WEEK = 1;

/** 数据生成：起始日期（去年的 12 月 30 日，周一） */
function getHeatmapStartDate(): Date {
  const now = new Date();
  const year = now.getFullYear();
  // 从去年 12 月 30 日开始（确保从周一开始）
  return new Date(year - 1, 11, 30);
}

/** 格式化日期键 "YYYY-M-D" */
function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 格式化中文日期 */
function formatDateChinese(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 计算某天是当年第几周 (ISO 周数) */
function getWeekNumber(d: Date): number {
  const temp = new Date(d);
  temp.setHours(0, 0, 0, 0);
  // 周四所在周为 ISO 周
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  return 1 + Math.round(
    ((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
  );
}

/** 获取当前周标识 "YYYY-Www" */
function getWeekKey(d: Date): string {
  const year = d.getFullYear();
  const week = getWeekNumber(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** 判断两天是否在同一周（ISO 周） */
function isSameWeek(d1: Date, d2: Date): boolean {
  return getWeekKey(d1) === getWeekKey(d2);
}

/* =============================================
   SVG Mini Icons
   ============================================= */
function FireMiniIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 4C12 4 9 9 7 12C5 15 6 18 8 19C9 17 10.5 16 12 16C13.5 16 15 17 15.5 18.5C16 16.5 16 14.5 15 12C14 10 12.5 7 12 4Z" fill="#D94C2A" stroke="#B83A1A" strokeWidth="0.8" />
      <path d="M12 4C12 4 10.5 8 9 10C10.5 11 11.5 12.5 12 14C12.5 12.5 13.5 11 15 10C13.5 8 12 4 12 4Z" fill="#F06A3E" />
      <path d="M13 16.5C13 17.3 12.7 18 12.3 18.5C12.8 18.2 13.5 17.3 13.5 16.7C13.5 16.1 13.2 15.8 13 16.5Z" fill="#F5A080" />
    </svg>
  );
}

function TrophyMiniIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 4H18V8C18 11.3 15.3 14 12 14C8.7 14 6 11.3 6 8V4Z" stroke="#B8860B" strokeWidth="1.3" fill="#FFD700" fillOpacity="0.5" />
      <path d="M8 14C8 14 9 18 12 18C15 18 16 14 16 14" stroke="#B8860B" strokeWidth="1.2" fill="#FFD700" fillOpacity="0.3" />
      <path d="M12 18V21" stroke="#B8860B" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9 21H15" stroke="#B8860B" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="7" y="3" width="10" height="1.5" rx="0.5" fill="#D4A017" />
    </svg>
  );
}

function StarMiniIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L15.5 9.5L22 10.5L17 15.5L18.5 22L12 18.5L5.5 22L7 15.5L2 10.5L8.5 9.5L12 3Z" stroke="#7A6B5A" strokeWidth="1.2" fill="#E8E0D0" fillOpacity="0.4" />
      <path d="M12 5L14.5 10L19 10.8L15.5 14.2L16.5 19L12 16.5L7.5 19L8.5 14.2L5 10.8L9.5 10L12 5Z" fill="#D4C8B5" fillOpacity="0.2" />
    </svg>
  );
}

function CrownMiniIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M2 18L5 7L9 12L12 5L15 12L19 7L22 18H2Z" stroke="#7A6B5A" strokeWidth="1.2" fill="#E8E0D0" fillOpacity="0.3" />
      <path d="M4 18H20V20C20 20.6 19.6 21 19 21H5C4.4 21 4 20.6 4 20V18Z" stroke="#7A6B5A" strokeWidth="1.2" fill="#D4C8B5" fillOpacity="0.2" />
    </svg>
  );
}

/* =============================================
   Data persistence
   ============================================= */

/** 从 localStorage 加载写作活动数据 */
function loadActivity(): Map<string, DayActivity> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, { level: number; wordCount: number; timestamp: number }>;
    const map = new Map<string, DayActivity>();
    for (const [key, val] of Object.entries(parsed)) {
      map.set(key, val);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** 保存写作活动数据到 localStorage */
function saveActivity(map: Map<string, DayActivity>): void {
  const obj: Record<string, { level: number; wordCount: number; timestamp: number }> = {};
  for (const [key, val] of map) {
    obj[key] = val;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

/** 加载 streak 设置 */
function loadSettings(): StreakSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function defaultSettings(): StreakSettings {
  return {
    freezeUsedThisWeek: 0,
    freezeTotalPerWeek: DEFAULT_FREEZE_PER_WEEK,
    lastFreezeWeek: null,
  };
}

function saveSettings(settings: StreakSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** 生成模拟写作数据（15 天连续打卡模式） */
function generateMockData(): Map<string, DayActivity> {
  const now = new Date();
  const start = getHeatmapStartDate();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const map = new Map<string, DayActivity>();
  const allDates: Date[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    allDates.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 86400000);
  }

  const totalDays = allDates.length;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  // 最近 15 天为连续打卡
  const streakStart = totalDays - 15;

  allDates.forEach((d, i) => {
    const key = formatDateKey(d);
    const year = d.getFullYear();
    const month = d.getMonth();

    let level = 0;
    let wordCount = 0;

    // 只生成当前年份/上一年份的数据
    if (year >= currentYear - 1) {
      if (i >= streakStart) {
        // 连续打卡区域：高活跃度
        level = Math.random() < 0.35 ? 4 : 3;
        wordCount = getMockWordCount(level);
      } else if (year === currentYear) {
        // 今年非连续区域：有概率的散落写作
        const progress = i / totalDays;
        const baseProb = 0.12 + progress * 0.3;
        if (Math.random() < baseProb) {
          const r = Math.random();
          level = r < 0.25 ? 1 : r < 0.55 ? 2 : r < 0.8 ? 3 : 4;
          wordCount = getMockWordCount(level);
        }
      } else if (year === currentYear - 1 && month >= 6) {
        // 去年下半年少量数据
        if (Math.random() < 0.08) {
          level = Math.random() < 0.5 ? 1 : 2;
          wordCount = getMockWordCount(level);
        }
      }
    }

    map.set(key, { level, wordCount, timestamp: d.getTime() });
  });

  return map;
}

function getMockWordCount(level: number): number {
  const ranges: Array<[number, number]> = [
    [0, 0],
    [100, 450],
    [550, 950],
    [1100, 1900],
    [2200, 7500],
  ];
  if (level === 0) return 0;
  const [min, max] = ranges[level];
  return Math.round(min + Math.random() * (max - min));
}

/* =============================================
   StreakTracker Component
   ============================================= */

export function StreakTracker() {
  const [activityMap, setActivityMap] = useState<Map<string, DayActivity>>(loadActivity);
  const [settings, setSettings] = useState<StreakSettings>(loadSettings);
  const [freezeConfirming, setFreezeConfirming] = useState(false);

  // 首次加载时，如果没有任何数据则生成模拟数据
  useEffect(() => {
    if (activityMap.size === 0) {
      const mock = generateMockData();
      setActivityMap(mock);
      saveActivity(mock);
    }
  }, [activityMap.size]);

  // 计算统计数据
  const stats = useMemo(() => computeStreakStats(activityMap), [activityMap]);

  const { currentStreak, personalBest, monthlyDays, yearlyDays, monthlyTotal } = stats;

  // 里程碑状态
  const milestones = useMemo(() => {
    return MILESTONES.map((m) => {
      if (currentStreak >= m.days) {
        return { ...m, status: "achieved" as const, statusText: "已达成" };
      }
      // 如果个人最佳 >= 里程碑天数，也算已达成
      if (personalBest >= m.days) {
        return { ...m, status: "achieved" as const, statusText: "已达成" };
      }
      // 进度：当前 streak 在里程碑的一半以上
      if (currentStreak >= m.days * 0.5) {
        const pct = Math.round((currentStreak / m.days) * 100);
        return { ...m, status: "progress" as const, statusText: `${pct}% 即将达成` };
      }
      const remaining = m.days - currentStreak;
      return { ...m, status: "locked" as const, statusText: `还需 ${remaining} 天` };
    });
  }, [currentStreak, personalBest]);

  // 热力图数据
  const heatmapData = useMemo(() => {
    return buildHeatmapData(activityMap);
  }, [activityMap]);

  // 冻结处理
  const handleFreeze = useCallback(() => {
    const now = new Date();
    const weekKey = getWeekKey(now);
    const isNewWeek = weekKey !== settings.lastFreezeWeek;

    // 如果是新的一周，重置使用次数
    const used = isNewWeek ? 0 : settings.freezeUsedThisWeek;
    if (used >= settings.freezeTotalPerWeek) {
      return; // 本周已用尽冻结次数
    }

    // 检查今天是否有写作活动 — 没有的话不能冻结
    const todayKey = formatDateKey(now);
    const todayActivity = activityMap.get(todayKey);
    if (!todayActivity || todayActivity.wordCount === 0) {
      // 今天没写作，尝试冻结
    }

    // 标记今天为"冻结"状态（等级至少设为 1，但不增加 streak）
    // 实际上冻结是将今天标记为特殊状态
    const updated = new Map(activityMap);
    const existing = updated.get(todayKey);
    if (existing && existing.level > 0) {
      // 今天已经有写作，不需要冻结
      return;
    }

    // 用 level=-1 表示冻结日，但热力图上显示为 lv1
    updated.set(todayKey, { level: -1, wordCount: 0, timestamp: now.getTime() });
    setActivityMap(updated);
    saveActivity(updated);

    const newSettings: StreakSettings = {
      ...settings,
      freezeUsedThisWeek: isNewWeek ? 1 : used + 1,
      lastFreezeWeek: weekKey,
    };
    setSettings(newSettings);
    saveSettings(newSettings);
    setFreezeConfirming(true);
    setTimeout(() => setFreezeConfirming(false), 2000);
  }, [activityMap, settings]);

  // 计算本周期冻结状态
  const freezeStatus = useMemo(() => {
    const now = new Date();
    const weekKey = getWeekKey(now);
    const isNewWeek = weekKey !== settings.lastFreezeWeek;
    const used = isNewWeek ? 0 : settings.freezeUsedThisWeek;
    const remaining = settings.freezeTotalPerWeek - used;
    return { used, remaining, total: settings.freezeTotalPerWeek };
  }, [settings]);

  // 检查今天是否已冻结
  const todayFrozen = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const today = activityMap.get(todayKey);
    return today ? today.level === -1 : false;
  }, [activityMap]);

  // 数据更新时间
  const dataUpdatedAt = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }, []);

  return (
    <div className="select-none" data-testid="streak-tracker">
      {/* 1. Streak Header */}
      <StreakHeader
        currentStreak={currentStreak}
        personalBest={personalBest}
        monthlyDays={monthlyDays}
        yearlyDays={yearlyDays}
        monthlyTotal={monthlyTotal}
      />

      {/* 2. Freeze Bar */}
      <FreezeBar
        freezeAvailable={freezeStatus.remaining}
        freezeRemaining={freezeStatus.remaining}
        freezeTotal={freezeStatus.total}
        freezeUsed={freezeStatus.used}
        onFreeze={handleFreeze}
        disabled={todayFrozen || freezeStatus.remaining <= 0}
        freezeConfirming={freezeConfirming}
        todayFrozen={todayFrozen}
      />

      {/* 3. Milestones */}
      <MilestoneSection milestones={milestones} />

      {/* 4. Calendar Heatmap */}
      <HeatmapSection heatmapData={heatmapData} />

      {/* 5. Footer */}
      <StreakFooter updatedAt={dataUpdatedAt} />
    </div>
  );
}

/* =============================================
   Stats computation
   ============================================= */

interface StreakStats {
  currentStreak: number;
  personalBest: number;
  monthlyDays: number;
  monthlyTotal: number;
  yearlyDays: number;
}

function computeStreakStats(activityMap: Map<string, DayActivity>): StreakStats {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = formatDateKey(today);

  // 收集所有有活动的日期（level > 0 或 level === -1 冻结日也算作活动）
  const activeDates: Date[] = [];
  for (const [key, act] of activityMap) {
    if (act.level > 0 || act.level === -1) {
      const d = new Date(act.timestamp);
      activeDates.push(d);
    }
  }

  // 按日期排序（降序）
  activeDates.sort((a, b) => b.getTime() - a.getTime());

  // 计算连续打卡
  let currentStreak = 0;
  const cursor = new Date(today);

  // 检查今天是否有活动（包括冻结日）
  const todayActive = activityMap.get(todayKey);
  const hasActivityToday = todayActive && (todayActive.level > 0 || todayActive.level === -1);

  if (!hasActivityToday) {
    // 如果今天没有活动，从昨天开始算
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = formatDateKey(cursor);
    const act = activityMap.get(key);
    if (act && (act.level > 0 || act.level === -1)) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // 个人最佳（遍历所有日期计算最长连续打卡）
  let personalBest = currentStreak;
  // 简单近似：遍历 activeDates
  const activeSet = new Set<string>();
  for (const [key, act] of activityMap) {
    if (act.level > 0 || act.level === -1) {
      activeSet.add(key);
    }
  }

  // 按日期排序（升序）
  const sortedActive = Array.from(activeSet).sort();
  let tempStreak = 0;
  let lastDate: Date | null = null;
  for (const key of sortedActive) {
    const parts = key.split("-");
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (lastDate) {
      const diff = (d.getTime() - lastDate.getTime()) / 86400000;
      if (diff === 1) {
        tempStreak++;
      } else {
        personalBest = Math.max(personalBest, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    lastDate = d;
  }
  personalBest = Math.max(personalBest, tempStreak);

  // 本月写作天数
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let monthlyDays = 0;
  for (const [key, act] of activityMap) {
    if (act.level > 0 || act.level === -1) {
      const parts = key.split("-");
      if (parseInt(parts[0]) === currentYear && parseInt(parts[1]) - 1 === currentMonth) {
        monthlyDays++;
      }
    }
  }

  // 本月总天数
  const monthlyTotal = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 今年累计天数
  let yearlyDays = 0;
  for (const [key, act] of activityMap) {
    if (act.level > 0 || act.level === -1) {
      const parts = key.split("-");
      if (parseInt(parts[0]) === currentYear) {
        yearlyDays++;
      }
    }
  }

  return { currentStreak, personalBest, monthlyDays, yearlyDays, monthlyTotal };
}

/* =============================================
   Heatmap data builder
   ============================================= */

interface HeatmapCell {
  date: Date;
  level: number;
  wordCount: number;
  isEmpty: boolean;
  isFirstOfMonth: boolean;
}

interface HeatmapData {
  /** 所有周的单元格，按列优先（先周后日）排列 */
  weeks: HeatmapCell[][];
  /** 月份标签信息 */
  monthLabels: Array<{ weekIndex: number; label: string }>;
  /** 星期标签 */
  dayLabels: string[];
}

function buildHeatmapData(activityMap: Map<string, DayActivity>): HeatmapData {
  const now = new Date();
  const start = getHeatmapStartDate();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 收集所有日期
  const allDates: Date[] = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    allDates.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 86400000);
  }

  const weeks: HeatmapCell[][] = [];
  const weeksCount = Math.ceil(allDates.length / 7);

  for (let w = 0; w < weeksCount; w++) {
    const col: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (idx < allDates.length) {
        const date = allDates[idx];
        const key = formatDateKey(date);
        const activity = activityMap.get(key);
        // level -1（冻结日）在热力图显示为 lv1
        const displayLevel = activity
          ? activity.level === -1
            ? 1
            : activity.level
          : 0;
        const wordCount = activity?.wordCount ?? 0;

        // 检查是否是新月份的第一天（用于月份标签）
        const isFirstOfMonth = date.getDate() === 1;

        col.push({
          date,
          level: displayLevel,
          wordCount,
          isEmpty: !activity || activity.level === 0,
          isFirstOfMonth,
        });
      } else {
        col.push({
          date: new Date(0),
          level: 0,
          wordCount: 0,
          isEmpty: true,
          isFirstOfMonth: false,
        });
      }
    }
    weeks.push(col);
  }

  // 生成月份标签：遍历每周第一天
  const monthLabels: Array<{ weekIndex: number; label: string }> = [];
  let lastMonth = -1;
  for (let w = 0; w < weeksCount; w++) {
    const dayIdx = w * 7;
    if (dayIdx < allDates.length) {
      const d = allDates[dayIdx];
      const m = d.getMonth();
      if (m !== lastMonth && d.getFullYear() === now.getFullYear()) {
        monthLabels.push({ weekIndex: w, label: `${m + 1}月` });
        lastMonth = m;
      }
    }
  }

  // 星期标签（周一、三、五显示）
  const dayLabels = ["一", "", "三", "", "五", "", ""];

  return { weeks, monthLabels, dayLabels };
}

/* =============================================
   Sub-components
   ============================================= */

/** 1. Streak Header — 火焰图标 + 连续天数 + 统计 */
function StreakHeader({
  currentStreak,
  personalBest,
  monthlyDays,
  yearlyDays,
  monthlyTotal,
}: {
  currentStreak: number;
  personalBest: number;
  monthlyDays: number;
  monthlyTotal: number;
  yearlyDays: number;
}) {
  return (
    <div className="flex items-center gap-4 pb-6 border-b border-[#EDE4D8] mb-6">
      {/* Fire Icon */}
      <div className="shrink-0 w-14 h-14 flex items-center justify-center">
        <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
          <path d="M24 44C32.2843 44 39 37.2843 39 29C39 20.7157 32.2843 14 24 14C15.7157 14 9 20.7157 9 29C9 37.2843 15.7157 44 24 44Z" fill="#E85D3A" opacity="0.15" />
          <path d="M24 40C31.1799 40 37 34.1799 37 27C37 19.8201 31.1799 14 24 14C16.8201 14 11 19.8201 11 27C11 34.1799 16.8201 40 24 40Z" fill="#E85D3A" opacity="0.25" />
          <path d="M24 36C29.5228 36 34 31.5228 34 26C34 20.4772 29.5228 16 24 16C18.4772 16 14 20.4772 14 26C14 31.5228 18.4772 36 24 36Z" fill="#E85D3A" opacity="0.4" />
          <path d="M23 12C23 12 20 18 17 22C14 26 15 31 18 33C19 30 21 28 23 28C25 28 26 29 27 31C28 28 28 25 27 22C26 19 24 15 23 12Z" fill="#D94C2A" />
          <path d="M23 12C23 12 21.5 16.5 19 19.5C21 21 22.5 23 23 26C23.5 23 25 21 27 19.5C24.5 16.5 23 12 23 12Z" fill="#F06A3E" />
          <path d="M25 30C25 31.5 24.5 33 23.5 34C24.5 33.5 26 32 26 30.5C26 29.5 25.5 29 25 30Z" fill="#F5A080" />
          <circle cx="24" cy="44" r="1.5" fill="#E85D3A" opacity="0.3" />
        </svg>
      </div>

      {/* Streak Info */}
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-5xl font-bold leading-none text-[#2C2416] dark:text-foreground">
            {currentStreak}
          </span>
          <span className="font-serif text-xl text-[#7A6B5A] dark:text-muted-foreground">天</span>
        </div>
        <div className="mt-1 text-sm text-[#7A6B5A] dark:text-muted-foreground flex flex-wrap gap-2">
          <span>个人最佳: <strong className="text-[#8B3A3A] dark:text-[#D4A090]">{personalBest}</strong>天</span>
          <span className="text-[#E8DFD0] dark:text-border">·</span>
          <span>本月写作 <strong className="text-[#8B3A3A] dark:text-[#D4A090]">{monthlyDays}</strong>/{monthlyTotal}天</span>
          <span className="text-[#E8DFD0] dark:text-border">·</span>
          <span>今年累计 <strong className="text-[#8B3A3A] dark:text-[#D4A090]">{yearlyDays}</strong>天</span>
        </div>
      </div>
    </div>
  );
}

/** 2. Freeze Bar — 冻结机制 */
function FreezeBar({
  freezeAvailable,
  freezeRemaining,
  freezeTotal,
  freezeUsed,
  onFreeze,
  disabled,
  freezeConfirming,
  todayFrozen,
}: {
  freezeAvailable: number;
  freezeRemaining: number;
  freezeTotal: number;
  freezeUsed: number;
  onFreeze: () => void;
  disabled: boolean;
  freezeConfirming: boolean;
  todayFrozen: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 bg-[#FBF7F2] dark:bg-muted/20 rounded-lg mb-6">
      <div className="flex items-center gap-2 text-sm text-[#7A6B5A] dark:text-muted-foreground">
        {/* Freeze icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0">
          <path d="M12 2V22M12 2L9 5M12 2L15 5M12 22L9 19M12 22L15 19M2 12H22M2 12L5 9M2 12L5 15M22 12L19 9M22 12L19 15" />
          <line x1="4.5" y1="4.5" x2="7.5" y2="7.5" />
          <line x1="19.5" y1="4.5" x2="16.5" y2="7.5" />
          <line x1="4.5" y1="19.5" x2="7.5" y2="16.5" />
          <line x1="19.5" y1="19.5" x2="16.5" y2="16.5" />
        </svg>
        <span>Streak Freeze</span>
        <strong className="text-[#2C2416] dark:text-foreground">{freezeAvailable > 0 ? `可用 ${freezeAvailable} 次` : "已用尽"}</strong>
      </div>

      <div className="flex items-center gap-4">
        {/* 剩余冻结圆点 */}
        <div className="flex items-center gap-1.5 text-xs text-[#B0A090] dark:text-muted-foreground">
          本周期冻结剩余
          <div className="flex gap-0.5">
            {Array.from({ length: freezeTotal }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i < freezeRemaining ? "bg-[#8B3A3A]" : "bg-[#E8DFD0] dark:bg-border"
                )}
              />
            ))}
          </div>
        </div>

        {/* 冻结按钮 */}
        <button
          type="button"
          onClick={onFreeze}
          disabled={disabled || todayFrozen}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border transition-all",
            disabled || todayFrozen
              ? "border-[#EDE4D8] dark:border-border bg-muted/30 text-[#B0A090] dark:text-muted-foreground cursor-not-allowed"
              : "border-[#EDE4D8] dark:border-border bg-white dark:bg-card text-[#2C2416] dark:text-foreground hover:bg-[#FAF6F0] dark:hover:bg-accent/20 active:scale-95",
            freezeConfirming && "border-[#D4A090] bg-[#FDF6F0] dark:bg-[#8B3A3A]/20 text-[#8B3A3A] dark:text-[#D4A090]"
          )}
        >
          {freezeConfirming || todayFrozen ? (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                <path d="M8 1L8 15M8 1L5 4M8 1L11 4M8 15L5 12M8 15L11 12M1 8H15M1 8L4 5M1 8L4 11M15 8L12 5M15 8L12 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="8" cy="8" r="2" fill="currentColor" />
              </svg>
              {todayFrozen ? "已冻结" : "已冻结 ✓"}
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L8 15M8 1L5 4M8 1L11 4M8 15L5 12M8 15L11 12M1 8H15M1 8L4 5M1 8L4 11M15 8L12 5M15 8L12 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <circle cx="8" cy="8" r="2" fill="currentColor" />
              </svg>
              冻结今天
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** 3. Milestones — 里程碑卡片 */
function MilestoneSection({ milestones }: {
  milestones: Array<MilestoneDef & { status: "achieved" | "progress" | "locked"; statusText: string }>;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-semibold tracking-[1.2px] uppercase text-[#B0A090] dark:text-muted-foreground mb-2">
        里程碑
      </div>
      <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
        {milestones.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-center transition-all",
              m.status === "achieved" && "border-[#D4A090] bg-[#FDF6F0] dark:bg-[#8B3A3A]/10",
              m.status === "progress" && "border-[#E8D0C0] dark:border-[#D4A090]/40",
              m.status === "locked" && "border-[#EDE4D8] dark:border-border opacity-65"
            )}
          >
            <span className="text-lg leading-none">{m.icon}</span>
            <span className="font-serif font-bold text-[#2C2416] dark:text-foreground">{m.label}</span>
            <span className={cn(
              "text-xs",
              m.status === "achieved" && "text-[#8B3A3A] dark:text-[#D4A090] font-semibold",
              m.status === "progress" && "text-[#8B3A3A] dark:text-[#D4A090] font-semibold",
              m.status === "locked" && "text-[#B0A090] dark:text-muted-foreground"
            )}>
              {m.statusText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 4. Heatmap Section — 年度写作日历 */
function HeatmapSection({ heatmapData }: { heatmapData: HeatmapData }) {
  const { weeks, monthLabels, dayLabels } = heatmapData;
  const weeksCount = weeks.length;

  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold tracking-[1.2px] uppercase text-[#B0A090] dark:text-muted-foreground mb-2">
        年度写作日历
      </div>
      <div className="overflow-x-auto pb-1 -webkit-overflow-scrolling-touch">
        <div className="flex gap-2 min-w-[700px]">
          {/* Day labels column */}
          <div className="grid grid-rows-7 gap-0.5">
            {dayLabels.map((label, i) => (
              <div
                key={i}
                className="text-[10px] text-[#B0A090] dark:text-muted-foreground leading-[13px] text-right pr-1 w-7"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div className="flex-1">
            {/* Month labels */}
            <div className="flex gap-0.5 mb-1 ml-0">
              {Array.from({ length: weeksCount }).map((_, w) => {
                const ml = monthLabels.find((m) => m.weekIndex === w);
                return (
                  <div
                    key={w}
                    className="text-[10px] text-[#B0A090] dark:text-muted-foreground font-medium h-4"
                    style={{ width: 13 }}
                  >
                    {ml?.label ?? ""}
                  </div>
                );
              })}
            </div>

            {/* Heatmap grid */}
            <div className="grid grid-rows-7 grid-flow-col gap-0.5">
              {weeks.map((col, w) =>
                col.map((cell, d) => {
                  if (cell.isEmpty && cell.date.getTime() === 0) {
                    return (
                      <div
                        key={`${w}-${d}`}
                        className="w-[13px] h-[13px] rounded-[2px] bg-transparent"
                      />
                    );
                  }

                  const levelClass = HEAT_LEVEL_CLASS[cell.level] ?? HEAT_LEVEL_CLASS[0];
                  const isToday = isSameDay(cell.date, new Date());
                  const dateLabel = formatDateChinese(cell.date);
                  const wordsLabel = cell.wordCount > 0 ? `${cell.wordCount.toLocaleString()}字` : "无写作";

                  return (
                    <div
                      key={`${w}-${d}`}
                      className={cn(
                        "w-[13px] h-[13px] rounded-[2px] cursor-pointer relative group transition-all duration-150",
                        HEAT_COLORS[cell.level] ?? HEAT_COLORS[0],
                        isToday && "ring-2 ring-[#8B3A3A] ring-offset-1"
                      )}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-[#2C2416] dark:bg-foreground text-white dark:text-background text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-10 translate-y-1 group-hover:translate-y-0">
                        {dateLabel}: {wordsLabel}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2C2416] dark:border-t-foreground" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <ColorLegend />
    </div>
  );
}

/** 判断两个日期是否为同一天 */
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** 5. Color Legend — 色阶说明 */
function ColorLegend() {
  const legendBlocks = [
    { level: 0, label: "" },
    { level: 1, label: "" },
    { level: 2, label: "" },
    { level: 3, label: "" },
    { level: 4, label: "" },
  ];

  return (
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EDE4D8] dark:border-border mt-4">
      <span className="text-[11px] text-[#B0A090] dark:text-muted-foreground font-medium">少</span>
      <div className="flex gap-0.5 items-center">
        {legendBlocks.map((b, i) => (
          <div
            key={i}
            className={cn(
              "w-[13px] h-[13px] rounded-[2px]",
              i === 0 && HEAT_COLORS[0],
              i === 1 && HEAT_COLORS[1],
              i === 2 && HEAT_COLORS[2],
              i === 3 && HEAT_COLORS[3],
              i === 4 && HEAT_COLORS[4],
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-[#B0A090] dark:text-muted-foreground font-medium">多</span>
      <div className="flex gap-2 text-[10px] text-[#B0A090] dark:text-muted-foreground ml-2">
        <span>0</span>
        <span>500</span>
        <span>1,000</span>
        <span>2,000</span>
        <span>4,000</span>
        <span>8,000+ 字/天</span>
      </div>
    </div>
  );
}

/** 6. Streak Footer */
function StreakFooter({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="flex justify-between items-center mt-4 pt-3.5 border-t border-[#EDE4D8] dark:border-border text-xs text-[#B0A090] dark:text-muted-foreground">
      <span>数据更新于 {updatedAt}</span>
      <span>连续写作 · 保持节奏</span>
    </div>
  );
}
