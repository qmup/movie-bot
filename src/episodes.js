const EPISODES_PER_PAGE = 20;
const EPISODES_PER_ROW = 5;

function trimLabel(text) {
  const value = String(text || '').trim() || 'Tập';
  return value.length <= 32 ? value : `${value.slice(0, 31)}…`;
}

function layoutEpisodeButtons(episodes, page) {
  const list = episodes || [];
  if (list.length === 1) {
    return {
      page: 0,
      totalPages: 1,
      rows: [[{ label: 'Xem phim', episodeIndex: 0 }]],
    };
  }

  const totalPages = Math.max(1, Math.ceil(list.length / EPISODES_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * EPISODES_PER_PAGE;
  const slice = list.slice(start, start + EPISODES_PER_PAGE);
  const rows = [];

  for (let i = 0; i < slice.length; i += EPISODES_PER_ROW) {
    rows.push(
      slice.slice(i, i + EPISODES_PER_ROW).map((episode, offset) => ({
        label: trimLabel(episode.name || String(start + i + offset + 1)),
        episodeIndex: start + i + offset,
      })),
    );
  }

  if (totalPages > 1) {
    const nav = [];
    if (safePage > 0) {
      nav.push({ label: '« Trang trước', page: safePage - 1 });
    }
    nav.push({ label: `${safePage + 1}/${totalPages}`, page: safePage });
    if (safePage < totalPages - 1) {
      nav.push({ label: 'Trang sau »', page: safePage + 1 });
    }
    rows.push(nav);
  }

  return { page: safePage, totalPages, rows };
}

module.exports = {
  EPISODES_PER_PAGE,
  EPISODES_PER_ROW,
  layoutEpisodeButtons,
};
