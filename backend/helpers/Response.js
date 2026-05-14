const err500 = (res, e) => res.status(500).json({ error: e.message });
const err400 = (res, msg) => res.status(400).json({ error: msg });
const err404 = (res, msg) => res.status(404).json({ error: msg });
const ok    = (res, data) => res.json({ success: true, ...data });

module.exports = { err500, err400, err404, ok };