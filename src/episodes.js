const EPISODES_PER_PAGE = 20;
const EPISODES_PER_ROW = 5;

function trimLabel(text) {
  const value = String(text || '').trim() || 'Tập';
  return value.length <= 32 ? value : `${value.slice(0, 31)}…`;
}

function isValidEmbed(embed) {
  return typeof embed === 'string' && /^https?:\/\//i.test(embed.trim());
}

function episodeCell(episode, episodeIndex, { single = false } = {}) {
  const embed = episode?.embed;
  const url = isValidEmbed(embed) ? embed.trim() : null;
  return {
    label: single ? '▶️ Xem phim' : trimLabel(episode?.name || String(episodeIndex + 1)),
    episodeIndex,
    url,
  };
}

function layoutEpisodeButtons(episodes, page) {
  const list = episodes || [];
  if (list.length === 1) {
    return {
      page: 0,
      totalPages: 1,
      rows: [[episodeCell(list[0], 0, { single: true })]],
    };
  }

  const totalPages = Math.max(1, Math.ceil(list.length / EPISODES_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * EPISODES_PER_PAGE;
  const slice = list.slice(start, start + EPISODES_PER_PAGE);
  const rows = [];

  for (let i = 0; i < slice.length; i += EPISODES_PER_ROW) {
    rows.push(
      slice.slice(i, i + EPISODES_PER_ROW).map((episode, offset) => (
        episodeCell(episode, start + i + offset)
      )),
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
  isValidEmbed,
  layoutEpisodeButtons,
};
