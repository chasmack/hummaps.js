module.exports = {
  "parser": "esprima",
  "env": {
    "node": true,
    "es6": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "semi": "error",
    "quotes": [2, "single"],
    "no-console": ["error", { allow: ["log", "warn", "error"] }],
    "no-constant-condition": ["error", { "checkLoops": false }]
  }
}
