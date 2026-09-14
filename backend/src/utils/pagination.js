function parsePagination(query, maxLimit = 100) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
module.exports = { parsePagination };
