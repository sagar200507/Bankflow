/**
 * Async Handler Wrapper
 * ─────────────────────
 * Wraps async route handlers so rejected promises are automatically
 * forwarded to Express's error-handling middleware via next(err).
 *
 * WITHOUT this wrapper:
 *   router.get('/foo', async (req, res) => {
 *     const data = await someQuery(); // if this throws, Express hangs!
 *     res.json(data);
 *   });
 *
 * WITH this wrapper:
 *   router.get('/foo', catchAsync(async (req, res) => {
 *     const data = await someQuery(); // rejection → next(err) automatically
 *     res.json(data);
 *   }));
 *
 * Express 5 handles this natively, but Express 4 requires this pattern.
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
