// UI-only adapter. Never included in extension ZIPs; no privileged APIs or network.
(() => {
  const scene = new URL(location.href).searchParams.get("scene");
  const owner = {
    id: "synthetic-owner",
    display_name: "合成体验账号",
    timezone: "Asia/Shanghai",
  };
  const items = [
    {
      id: "demo-1",
      title: "合成红队 vs 合成蓝队",
      sport: "basketball",
      starts_at: "2026-09-10T11:30:00Z",
      status: "scheduled",
      demo: true,
      included: true,
      links: [],
    },
    {
      id: "demo-2",
      title: "合成东城 vs 合成西城",
      sport: "football",
      starts_at: "2026-09-11T13:00:00Z",
      status: "scheduled",
      demo: true,
      included: true,
      links: [],
    },
    {
      id: "demo-3",
      title: "合成大奖赛 · 排位赛",
      sport: "racing",
      starts_at: "2026-09-12T06:00:00Z",
      status: "postponed",
      demo: true,
      included: true,
      links: [],
    },
  ];
  const makeDraft = () => ({
    id: "synthetic-draft",
    ownerId: owner.id,
    title: "合成视频 · 比赛前瞻",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    createdAt: Date.now(),
  });
  let view = {
    connected: scene !== "guest",
    canWrite: scene !== "readonly",
    connecting: false,
    local: true,
    profile: scene === "guest" ? null : owner,
    cache: null,
    draft: scene === "draft" ? makeDraft() : null,
    preferences: { dataset: "demo", followed: true },
    notice: "",
  };
  window.chrome = {
    runtime: {
      async sendMessage(m) {
        let data;
        switch (m.type) {
          case "state":
            data = view;
            break;
          case "login":
            view = {
              ...view,
              connected: true,
              canWrite: true,
              profile: owner,
              draft: null,
              notice: "合成连接示例",
            };
            data = view;
            break;
          case "logout":
            view = {
              ...view,
              connected: false,
              profile: null,
              cache: null,
              draft: null,
              notice: "合成退出示例",
            };
            data = view;
            break;
          case "schedule":
            if (scene === "offline")
              return {
                ok: false,
                code: "NETWORK",
                message: "合成断网状态：暂时无法连接日历服务，请重试",
              };
            view.preferences = { dataset: m.dataset, followed: m.followed };
            view.cache = {
              ownerId: owner.id,
              items: scene === "empty" || m.dataset === "real" ? [] : items,
              fetchedAt: Date.now(),
              dataset: m.dataset,
              followed: m.followed,
            };
            data = view;
            break;
          case "current_video":
            view.draft = makeDraft();
            data = view.draft;
            break;
          case "edit_draft":
            view.draft = {
              ...view.draft,
              title: m.title,
              kind: m.kind,
              event: items.find((e) => e.id === m.eventId),
            };
            data = view.draft;
            break;
          case "find_events":
            data = items.filter((e) => !m.q || e.title.includes(m.q));
            break;
          case "submit":
            view.draft = {
              ...view.draft,
              event: items.find((e) => e.id === m.eventId),
              kind: m.kind,
              title: m.title,
              outcome: "saved",
            };
            data = view.draft;
            break;
          case "discard_draft":
            view.draft = null;
            data = view;
            break;
          case "open_web":
            return {
              ok: false,
              code: "VISUAL_ONLY",
              message: "这里只是合成界面预览，没有打开或修改真实日历",
            };
          default:
            return {
              ok: false,
              code: "FIXTURE",
              message: "合成预览不支持此操作",
            };
        }
        return structuredClone({ ok: true, data });
      },
    },
  };
})();
