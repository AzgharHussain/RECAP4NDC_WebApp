// middlewares/cacheControl.js
const setNoCacheHeaders = (req, res, next) => {
  // Don't set no-cache for static assets
  if (req.path.match(/\.(css|js|jpg|png|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } 
  // Set no-cache for API routes
  else if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
};

module.exports = setNoCacheHeaders;