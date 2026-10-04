const axios = require('axios');

const BASE_URL = 'https://phim.nguonc.com/api';

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

function get(path, params) {
  return http.get(path, { params }).then((response) => response.data);
}

function searchFilms(keyword, page = 1) {
  return get('/films/search', { keyword, page });
}

function getFilm(slug) {
  return get(`/film/${encodeURIComponent(slug)}`);
}

// Các endpoint dưới đây chỉ khai báo để mở rộng. Chưa gắn vào chat.

function latestFilms(page = 1) {
  return get('/films/phim-moi-cap-nhat', { page });
}

function filmsByList(slug, page = 1) {
  return get(`/films/danh-sach/${encodeURIComponent(slug)}`, { page });
}

function filmsByGenre(slug, page = 1) {
  return get(`/films/the-loai/${encodeURIComponent(slug)}`, { page });
}

function filmsByCountry(slug, page = 1) {
  return get(`/films/quoc-gia/${encodeURIComponent(slug)}`, { page });
}

function filmsByYear(year, page = 1) {
  return get(`/films/nam-phat-hanh/${encodeURIComponent(year)}`, { page });
}

module.exports = {
  BASE_URL,
  searchFilms,
  getFilm,
  latestFilms,
  filmsByList,
  filmsByGenre,
  filmsByCountry,
  filmsByYear,
};
