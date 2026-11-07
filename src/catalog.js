const { buildKeywordVariants } = require('./search');

const QUERY_MAX_LENGTH = 150;

async function findFilms(searchFilms, keyword, page) {
  const query = String(keyword || '').trim().slice(0, QUERY_MAX_LENGTH);
  if (!query) return { status: 'empty', query };

  let data;
  let usedQuery = query;
  for (const variant of buildKeywordVariants(query)) {
    data = await searchFilms(variant, page);
    if (data?.status && data.status !== 'success') return { status: 'error', query };
    if (Array.isArray(data?.items) && data.items.length > 0) {
      usedQuery = variant;
      break;
    }
  }

  const paginate = data?.paginate || {};
  return {
    status: 'ok',
    query,
    usedQuery,
    items: Array.isArray(data?.items) ? data.items : [],
    totalPage: Number(paginate.total_page) || 1,
    currentPage: Number(paginate.current_page) || page,
    totalItems: Number(paginate.total_items),
  };
}

function isSingleResult(found) {
  return found.totalPage <= 1
    && found.items.length === 1
    && (!Number.isFinite(found.totalItems) || found.totalItems <= 1);
}

module.exports = {
  findFilms,
  isSingleResult,
};
