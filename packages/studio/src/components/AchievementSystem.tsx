import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, X, Flame } from "lucide-react";
import { StreakTracker } from "./StreakTracker";
import { cn } from "@/lib/utils";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_chapter", title: "初露锋芒", description: "完成第 1 章", icon: "✍️", unlocked: false },
  { id: "ten_chapters", title: "笔耕不辍", description: "完成第 10 章", icon: "📝", unlocked: false },
  { id: "fifty_chapters", title: "著作等身", description: "完成第 50 章", icon: "📚", unlocked: false },
  { id: "hundred_k_words", title: "十万雄文", description: "总字数突破 10 万字", icon: "🎯", unlocked: false },
  { id: "five_hundred_k_words", title: "半百万里程碑", description: "总字数突破 50 万字", icon: "🏆", unlocked: false },
  { id: "first_session", title: "初次对话", description: "完成第一次 AI 写作会话", icon: "💬", unlocked: false },
  { id: "all_approved", title: "精益求精", description: "连续 10 章审核通过", icon: "⭐", unlocked: false },
];

const STORAGE_KEY = "inkos-achievements";

function loadAchievements(): Achievement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_ACHIEVEMENTS.map((a) => ({ ...a }));
    const stored = JSON.parse(raw) as Record<string, boolean>;
    return ALL_ACHIEVEMENTS.map((a) => ({ ...a, unlocked: stored[a.id] ?? false }));
  } catch {
    return ALL_ACHIEVEMENTS.map((a) => ({ ...a }));
  }
}

function saveAchievements(achievements: Achievement[]): void {
  const map: Record<string, boolean> = {};
  for (const a of achievements) {
    map[a.id] = a.unlocked;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface AchievementSystemProps {
  readonly totalChapters: number;
  readonly totalWords: number;
  readonly sessionCount: number;
  readonly consecutiveApproved: number;
}

export function AchievementSystem({
  totalChapters,
  totalWords,
  sessionCount,
  consecutiveApproved,
}: AchievementSystemProps) {
  const [achievements, setAchievements] = useState<Achievement[]>(loadAchievements);
  const [justUnlocked, setJustUnlocked] = useState<Achievement | null>(null);

  // Check and unlock achievements
  useEffect(() => {
    const updated = achievements.map((a) => {
      if (a.unlocked) return a;

      let shouldUnlock = false;
      switch (a.id) {
        case "first_chapter":
          shouldUnlock = totalChapters >= 1;
          break;
        case "ten_chapters":
          shouldUnlock = totalChapters >= 10;
          break;
        case "fifty_chapters":
          shouldUnlock = totalChapters >= 50;
          break;
        case "hundred_k_words":
          shouldUnlock = totalWords >= 100_000;
          break;
        case "five_hundred_k_words":
          shouldUnlock = totalWords >= 500_000;
          break;
        case "first_session":
          shouldUnlock = sessionCount >= 1;
          break;
        case "all_approved":
          shouldUnlock = consecutiveApproved >= 10;
          break;
      }

      if (shouldUnlock) {
        setJustUnlocked({ ...a, unlocked: true });
        return { ...a, unlocked: true };
      }
      return a;
    });

    const changed = updated.some(
      (u, i) => u.unlocked !== achievements[i]?.unlocked,
    );
    if (changed) {
      setAchievements(updated);
      saveAchievements(updated);
    }
  }, [totalChapters, totalWords, sessionCount, consecutiveApproved, achievements]);

  const [showDialog, setShowDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"achievements" | "streak">("achievements");

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <>
      {/* Achievement badge in nav */}
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        title="成就 · 连续打卡"
      >
        <Trophy size={14} />
        <span>{unlockedCount}/{achievements.length}</span>
      </button>

      {/* Achievement / Streak dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              写作成就
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                {unlockedCount}/{achievements.length}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border/50 pb-2 -mt-2">
            <button
              type="button"
              onClick={() => setActiveTab("achievements")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === "achievements"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )}
            >
              <Trophy size={13} />
              成就
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("streak")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === "streak"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )}
            >
              <Flame size={13} />
              连续打卡
            </button>
          </div>

          {activeTab === "achievements" && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                    a.unlocked
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/30"
                      : "bg-muted/20 border border-border/10 opacity-50"
                  }`}
                >
                  <span className="text-xl">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${a.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                      {a.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {a.description}
                    </p>
                  </div>
                  {a.unlocked && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      已解锁
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "streak" && (
            <div className="max-h-[520px] overflow-y-auto pr-1 -mr-1 scrollbar-thin">
              <StreakTracker />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Just-unlocked toast */}
      {justUnlocked && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200/30 bg-amber-50 dark:bg-amber-950/30 shadow-lg px-4 py-3">
            <span className="text-2xl">{justUnlocked.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                成就解锁: {justUnlocked.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {justUnlocked.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJustUnlocked(null)}
              className="ml-2 rounded-full p-1 hover:bg-accent/50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
