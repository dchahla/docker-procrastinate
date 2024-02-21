const router = require("express").Router();
const { urlencoded } = require("body-parser");
const querystring = require("node:querystring");

const { usersTable } = require("../utils/data");
const { generateCsrfToken, validateCsrfToken } = require("../utils/csrf");
const { BadRequestError } = require("../utils/error");
const { requiresAuth } = require("../utils/auth");
const { hash, compare } = require("../utils/password");

// endpoints

router.get("/profile", requiresAuth(), async (req, res) => {
  const { row: profile } = await usersTable.findRow(
    (r) => r.id === req.user.id
  );

  const { updated = [] } = req.query;
  const profile_updated = updated.includes("profile");
  const password_updated = updated.includes("password");

  const csrf_token = generateCsrfToken(req, res);
  res.render("profile", {
    csrf_token,
    profile,
    profile_updated,
    password_updated,
  });
});

router.post(
  "/profile",
  requiresAuth(),
  urlencoded({ extended: false }),
  validateCsrfToken(),
  async (req, res) => {
    const { display_name, old_password, new_password } = req.body;
    if (!display_name) {
      throw BadRequestError("Missing: display_name");
    }

    const updated = [];

    const { row: profile } = await usersTable.findRow(
      (r) => r.id === req.user.id
    );

    // update profile
    if (profile.display_name !== display_name) {
      profile.display_name = display_name;
      updated.push("profile");
    }

    // update password
    if (new_password) {
      if (!old_password) {
        const csrf_token = generateCsrfToken(req, res);
        return res.status(400).render("profile", {
          csrf_token,
          profile,
          error_message: "Provide your existing password to set a new one",
        });
      }

      if (await compare(old_password, profile.password_hash)) {
        profile.password_hash = await hash(new_password);
        updated.push("password");
      } else {
        const csrf_token = generateCsrfToken(req, res);
        return res.status(400).render("profile", {
          csrf_token,
          profile,
          error_message: "Incorrect existing password",
        });
      }
    }

    await usersTable.updateRow((r) => r.id === profile.id, profile);

    res.redirect(`/profile?${querystring.stringify({ updated })}`);
  }
);

module.exports = router;
