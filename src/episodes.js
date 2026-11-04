const { buildWatchUrl } = require('./watchUrl');

const EPISODES_PER_PAGE = 20;
const EPISODES_PER_ROW = 5;
const PAGES_PER_BLOCK = 5;
const MAX_RANGE_BUTTONS = 30;

function trimLabel(text) {
  const value = String(text || '').trim() || 'Tập';
  return value.length <= 32 ? value : `${value.slice(0, 31)}…`;
}

function isValidEmbed(embed) {
  return typeof embed === 'string' && /^https?:\/\//i.test(embed.trim());
}

function episodeCell(episode, episodeIndex, { single = false, filmSlug } = {}) {
  const embed = episode?.embed;
  const raw = isValidEmbed(embed) ? embed.trim() : null;
  const url = raw ? buildWatchUrl(raw, { filmSlug }) : null;
  return {
    label: single ? '▶️ Xem phim' : trimLabel(episode?.name || String(episodeIndex + 1)),
    episodeIndex,
    url,
  };
}

function layoutEpisodeButtons(episodes, page, options = {}) {
  const list = episodes || [];
  const cellOptions = { filmSlug: options.filmSlug };
  if (list.length === 1) {
    return {
      page: 0,
      totalPages: 1,
      rows: [[episodeCell(list[0], 0, { ...cellOptions, single: true })]],
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
        episodeCell(episode, start + i + offset, cellOptions)
      )),
    );
  }

  if (totalPages > 1) {
    rows.push(...navigationRows(list, safePage, totalPages));
  }

  return { page: safePage, totalPages, rows };
}

function layoutEpisodeRanges(episodes, backPage = 0) {
  const list = episodes || [];
  const totalPages = Math.max(1, Math.ceil(list.length / EPISODES_PER_PAGE));
  const safeBack = Math.min(Math.max(0, backPage), totalPages - 1);
  const size = episodesPerRange(list.length);
  const buttons = [];

  for (let start = 0; start < list.length; start += size) {
    const end = Math.min(list.length, start + size) - 1;
    const page = Math.floor(start / EPISODES_PER_PAGE);
    const lastPage = Math.floor(end / EPISODES_PER_PAGE);
    const label = spanLabel(list, start, end);
    buttons.push({
      label: safeBack >= page && safeBack <= lastPage ? markCurrent(label) : label,
      page,
    });
  }

  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  rows.push([{ label: '« Quay lại', page: safeBack }]);
  return { page: safeBack, totalPages, rows };
}

function navigationRows(list, safePage, totalPages) {
  if (totalPages <= PAGES_PER_BLOCK) {
    return [stepNav(safePage, totalPages, true)];
  }

  const rows = [];
  const chips = blockChips(list, safePage, totalPages);
  if (chips.length > 1) rows.push(chips);
  rows.push(jumpNav(safePage, totalPages));
  const step = stepNav(safePage, totalPages, false);
  if (step.length) rows.push(step);
  return rows;
}

function stepNav(safePage, totalPages, indicator) {
  const nav = [];
  if (safePage > 0) nav.push({ label: '« Trang trước', page: safePage - 1 });
  if (indicator) nav.push({ label: `${safePage + 1}/${totalPages}`, page: safePage });
  if (safePage < totalPages - 1) nav.push({ label: 'Trang sau »', page: safePage + 1 });
  return nav;
}

function jumpNav(safePage, totalPages) {
  const nav = [];
  const step = totalPages > 30 ? 10 : 5;
  if (safePage > 0) nav.push({ label: '« Đầu', page: 0 });
  if (safePage - step > 0) nav.push({ label: `-${step}`, page: safePage - step });
  nav.push({ label: `${safePage + 1}/${totalPages}`, ranges: true, page: safePage });
  if (safePage + step < totalPages - 1) {
    nav.push({ label: `+${step}`, page: safePage + step });
  }
  if (safePage < totalPages - 1) nav.push({ label: 'Cuối »', page: totalPages - 1 });
  return nav;
}

function blockChips(list, safePage, totalPages) {
  const blockStart = Math.floor(safePage / PAGES_PER_BLOCK) * PAGES_PER_BLOCK;
  const blockEnd = Math.min(totalPages, blockStart + PAGES_PER_BLOCK);
  const chips = [];
  for (let page = blockStart; page < blockEnd; page += 1) {
    const start = page * EPISODES_PER_PAGE;
    const end = Math.min(list.length, start + EPISODES_PER_PAGE) - 1;
    const label = spanLabel(list, start, end);
    chips.push({
      label: page === safePage ? markCurrent(label) : label,
      page,
    });
  }
  return chips;
}

function episodesPerRange(total) {
  const block = EPISODES_PER_PAGE * PAGES_PER_BLOCK;
  let size = block;
  if (total <= 0) return size;
  while (Math.ceil(total / size) > MAX_RANGE_BUTTONS) size += block;
  return size;
}

function spanLabel(list, start, end) {
  const left = episodeName(list[start], start);
  const right = episodeName(list[end], end);
  if (left === right) return trimLabel(left);
  const full = `${left}–${right}`;
  if (full.length <= 20) return full;
  const compact = `${compactEpisodeName(list[start], start)}–${compactEpisodeName(list[end], end)}`;
  return compact.length <= 32 ? compact : `${start + 1}–${end + 1}`;
}

function episodeName(episode, index) {
  const name = String(episode?.name || '').trim();
  return name || String(index + 1);
}

function compactEpisodeName(episode, index) {
  const name = episodeName(episode, index);
  if (/^\d+$/.test(name)) return name;
  const match = name.match(/(\d+)\s*$/);
  return match ? match[1] : String(index + 1);
}

function markCurrent(label) {
  const marked = `[${label}]`;
  return marked.length <= 32 ? marked : label;
}

module.exports = {
  EPISODES_PER_PAGE,
  EPISODES_PER_ROW,
  isValidEmbed,
  layoutEpisodeButtons,
  layoutEpisodeRanges,
};
