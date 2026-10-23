/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/auth.js
   The DEMO sign-in and registration.

   READ THIS BEFORE USING THE SITE
   -------------------------------
   This is a classroom simulation, not authentication.

   - No password is ever asked for, so no password is ever stored.
   - The demo passcodes live in assets/js/data.js as plain text and are
     printed in the README on purpose, so anybody can try the prototype.
   - The "session" is a record in localStorage. Anybody with access to the
     browser can read it, change it or delete it.
   - The role check here is a convenience for the demonstration. It is NOT a
     security boundary. A real site needs a trusted backend or an
     authentication provider that enforces access rules on the server.
   ========================================================================== */

var LutongAuth = (function () {
  "use strict";

  /* Looks up one of the two built-in demo accounts. */
  function findDemoAccount(username) {
    var name = String(username || "").trim().toLowerCase();
    for (var i = 0; i < LUTONG_DEMO_ACCOUNTS.length; i += 1) {
      if (LUTONG_DEMO_ACCOUNTS[i].username.toLowerCase() === name) {
        return LUTONG_DEMO_ACCOUNTS[i];
      }
    }
    return null;
  }

  /* Looks up an account created through the Register page. */
  function findRegisteredUser(username) {
    var name = String(username || "").trim().toLowerCase();
    var users = lutongGetUsers();
    for (var i = 0; i < users.length; i += 1) {
      if (users[i].username.toLowerCase() === name) {
        return users[i];
      }
    }
    return null;
  }

  function usernameTaken(username) {
    return findDemoAccount(username) !== null || findRegisteredUser(username) !== null;
  }

  function emailTaken(email) {
    var address = String(email || "").trim().toLowerCase();
    var users = lutongGetUsers();

    for (var i = 0; i < users.length; i += 1) {
      if (users[i].email.toLowerCase() === address) {
        return true;
      }
    }
    for (var j = 0; j < LUTONG_DEMO_ACCOUNTS.length; j += 1) {
      if (LUTONG_DEMO_ACCOUNTS[j].email.toLowerCase() === address) {
        return true;
      }
    }
    return false;
  }

  /* Signs a demo account in.
     Returns { ok: true, session } or { ok: false, field, message }. */
  function signIn(username, email, passcode) {
    var name = String(username || "").trim();
    var address = String(email || "").trim();
    var code = String(passcode || "").trim();

    if (!name) {
      return { ok: false, field: "username", message: "Username is required." };
    }
    if (!address) {
      return { ok: false, field: "email", message: "Email address is required." };
    }
    if (!code) {
      return { ok: false, field: "passcode", message: "Account passcode is required." };
    }

    var demo = findDemoAccount(name);
    var registered = demo ? null : findRegisteredUser(name);

    if (!demo && !registered) {
      return {
        ok: false,
        field: "username",
        message: "No account uses that username. Please try a registered username or your staff account."
      };
    }

    var account = demo || registered;

    if (account.email.toLowerCase() !== address.toLowerCase()) {
      return {
        ok: false,
        field: "email",
        message: "That email address does not match this account."
      };
    }

    // The two built-in accounts have their own public passcode. Accounts made
    // through the Register page share one public demo passcode. None of these
    // values is a real password and none of them is stored.
    var expected = demo ? demo.passcode : LUTONG_REGISTERED_PASSCODE;

    if (code !== expected) {
      return { ok: false, field: "passcode", message: "That passcode is not correct." };
    }

    var session = {
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role === "admin" ? "admin" : "user",
      loginAt: new Date().toISOString(),
      isNew: false
    };

    lutongSaveSession(session);
    return { ok: true, session: session };
  }

  /* Creates a demo CUSTOMER account.
     The role is always "user" — there is no way to register as an admin. */
  function register(displayName, username, email) {
    if (usernameTaken(username)) {
      return { ok: false, field: "username", message: "That username is already taken." };
    }
    if (emailTaken(email)) {
      return { ok: false, field: "email", message: "That email address is already registered." };
    }

    var users = lutongGetUsers();
    var user = {
      id: "u_" + Date.now().toString(36),
      username: String(username).trim(),
      displayName: String(displayName).trim(),
      email: String(email).trim(),
      role: "user",
      createdAt: new Date().toISOString()
    };

    users.push(user);
    lutongSaveUsers(users);

    // Sign the new customer straight in so they can try ordering at once.
    var session = {
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: "user",
      loginAt: new Date().toISOString(),
      isNew: true
    };
    lutongSaveSession(session);

    return { ok: true, user: user, session: session };
  }

  function signOut() {
    lutongClearSession();
  }

  function getSession() {
    return lutongGetSession();
  }

  function isAdmin(session) {
    return !!session && session.role === "admin";
  }

  /* The sign-in page uses this to fill the demo credentials. */
  function getDemoCredentials(role) {
    var wanted = role === "admin" ? "admin" : "user";
    for (var i = 0; i < LUTONG_DEMO_ACCOUNTS.length; i += 1) {
      if (LUTONG_DEMO_ACCOUNTS[i].role === wanted) {
        return LUTONG_DEMO_ACCOUNTS[i];
      }
    }
    return null;
  }

  return {
    signIn: signIn,
    register: register,
    signOut: signOut,
    getSession: getSession,
    isAdmin: isAdmin,
    getDemoCredentials: getDemoCredentials,
    usernameTaken: usernameTaken,
    emailTaken: emailTaken
  };
})();
