// middlewares/validateHttpHeaders.js

module.exports = (req, res, next) => {
  // Check for ambiguous headers that could cause request smuggling
  const contentLength = req.headers['content-length'];
  const transferEncoding = req.headers['transfer-encoding'];
  
  // Case 1: Both Content-Length and Transfer-Encoding present
  if (contentLength && transferEncoding) {
    console.warn('⚠️ Request smuggling attempt detected: Both Content-Length and Transfer-Encoding headers present');
    return res.status(400).json({
      success: false,
      error: 'Invalid request headers'
    });
  }
  
  // Case 2: Multiple Content-Length headers
  if (req.headers['content-length'] && Array.isArray(req.headers['content-length'])) {
    console.warn('⚠️ Request smuggling attempt detected: Multiple Content-Length headers');
    return res.status(400).json({
      success: false,
      error: 'Invalid request headers'
    });
  }
  
  // Case 3: Multiple Transfer-Encoding headers
  if (req.headers['transfer-encoding'] && Array.isArray(req.headers['transfer-encoding'])) {
    console.warn('⚠️ Request smuggling attempt detected: Multiple Transfer-Encoding headers');
    return res.status(400).json({
      success: false,
      error: 'Invalid request headers'
    });
  }
  
  // Case 4: Transfer-Encoding with invalid value
  if (transferEncoding && !transferEncoding.toLowerCase().includes('chunked')) {
    console.warn('⚠️ Request smuggling attempt detected: Invalid Transfer-Encoding value');
    return res.status(400).json({
      success: false,
      error: 'Invalid request headers'
    });
  }
  
  next();
};