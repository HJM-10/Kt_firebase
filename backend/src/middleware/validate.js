const { ZodError } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (parsed.body) req.body = parsed.body;
    next();
  } catch (error) {
    if (error.name === 'ZodError' || error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: (error.errors || error.issues).map(e => ({ path: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

module.exports = validate;
