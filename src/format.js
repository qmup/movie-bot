const PHOTO_CAPTION_LIMIT = 1024;

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (all, num) => {
      const code = Number(num);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    })
    .replace(/&#x([0-9a-f]+);/gi, (all, hex) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    })
    .replace(/&([a-z]+);/gi, (all, name) => NAMED_ENTITIES[name.toLowerCase()] ?? all);
}

function stripHtml(value) {
  const withBreaks = String(value ?? '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*\/\s*div\s*>/gi, '\n')
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n');
  const noTags = withBreaks.replace(/<[^>]*>/g, '');
  return decodeEntities(noTags)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncateText(value, limit) {
  const text = String(value ?? '');
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  if (limit === 1) return '…';

  let cut = text.slice(0, limit - 1).replace(/\s+$/u, '');
  const amp = cut.lastIndexOf('&');
  if (amp >= 0 && !cut.slice(amp).includes(';')) {
    cut = cut.slice(0, amp).replace(/\s+$/u, '');
  }
  if (!cut) return '…';
  return `${cut}…`;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function categoryNames(movie, groupName) {
  const category = movie?.category || {};
  for (const entry of Object.values(category)) {
    if (entry?.group?.name === groupName) {
      return (entry.list || [])
        .map((item) => item?.name)
        .filter(hasValue)
        .join(', ');
    }
  }
  return '';
}

function taggedLine(tag, text) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const safe = escapeHtml(text);
  const wrapped = `${open}${safe}${close}`;
  if (wrapped.length <= PHOTO_CAPTION_LIMIT) return wrapped;
  const room = PHOTO_CAPTION_LIMIT - open.length - close.length;
  return `${open}${truncateText(safe, room)}${close}`;
}

function fieldLine(label, value) {
  if (!hasValue(value)) return '';
  return `${escapeHtml(label)}: ${escapeHtml(value)}`;
}

function joinCaption(lines, description) {
  const header = lines.filter(Boolean).join('\n');
  if (!description) return header;
  return `${header}\n\n${description}`;
}

function fitPlain(full, apply, render) {
  if (render().length <= PHOTO_CAPTION_LIMIT) return;
  const source = String(full || '');
  if (!source) {
    apply('');
    return;
  }

  let low = 0;
  let high = source.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const next = mid >= source.length ? source : truncateText(source, mid);
    apply(next);
    if (render().length <= PHOTO_CAPTION_LIMIT) {
      best = next;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  apply(best);
}

function detailLines(movie, options, fields) {
  const lines = [taggedLine('b', hasValue(movie?.name) ? movie.name : 'Chưa rõ tên')];
  if (hasValue(movie?.original_name)) {
    lines.push(taggedLine('i', movie.original_name));
  }
  lines.push(
    fieldLine('Năm', movie?.year),
    fieldLine('Thời lượng', movie?.time),
    fieldLine('Chất lượng', movie?.quality),
    fieldLine('Ngôn ngữ', movie?.language),
    fieldLine('Trạng thái', movie?.current_episode),
    fieldLine('Đạo diễn', fields.director),
    fieldLine('Diễn viên', fields.casts),
    fieldLine('Định dạng', categoryNames(movie, 'Định dạng')),
    fieldLine('Thể loại', categoryNames(movie, 'Thể loại')),
    fieldLine('Quốc gia', categoryNames(movie, 'Quốc gia')),
    fieldLine('Server', options.serverName),
  );
  return joinCaption(lines, fields.description ? escapeHtml(fields.description) : '');
}

function buildDetailCaption(movie, options = {}) {
  const fields = {
    director: hasValue(movie?.director) ? String(movie.director) : '',
    casts: hasValue(movie?.casts) ? String(movie.casts) : '',
    description: stripHtml(movie?.description || ''),
  };
  const render = () => detailLines(movie, options, fields);

  fitPlain(fields.description, (next) => {
    fields.description = next;
  }, render);
  fitPlain(fields.casts, (next) => {
    fields.casts = next;
  }, render);
  fitPlain(fields.director, (next) => {
    fields.director = next;
  }, render);

  const caption = render();
  return caption.length <= PHOTO_CAPTION_LIMIT
    ? caption
    : truncateText(caption, PHOTO_CAPTION_LIMIT);
}

function buildSearchCaption(item) {
  const lines = [taggedLine('b', hasValue(item?.name) ? item.name : 'Chưa rõ tên')];
  if (hasValue(item?.original_name)) {
    lines.push(taggedLine('i', item.original_name));
  }
  lines.push(
    fieldLine('Năm', item?.year),
    fieldLine('Thời lượng', item?.time),
    fieldLine('Chất lượng', item?.quality),
    fieldLine('Ngôn ngữ', item?.language),
    fieldLine('Tập hiện tại', item?.current_episode),
  );
  const caption = lines.filter(Boolean).join('\n');
  return caption.length <= PHOTO_CAPTION_LIMIT
    ? caption
    : truncateText(caption, PHOTO_CAPTION_LIMIT);
}

module.exports = {
  PHOTO_CAPTION_LIMIT,
  stripHtml,
  escapeHtml,
  truncateText,
  buildSearchCaption,
  buildDetailCaption,
  categoryNames,
};
