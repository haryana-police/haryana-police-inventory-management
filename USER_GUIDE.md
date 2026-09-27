# Haryana Police Inventory App — User Guide

**App URL:** https://hp-inventory.vercel.app

The app works on any device with an internet browser (phone, laptop, tablet).

---

## How to Log In

1. Open **https://hp-inventory.vercel.app** in your browser.
2. Enter your **Username** and the **Password** provided to you by your admin (passwords are intentionally hidden in this guide).
3. Click **Sign In**.
4. Use the menu on the left to browse Dashboard, Inventory, Transactions, Demands, Inspections, Allotments, and Reports. The notification bell (top-right), **Users**, and **Districts** buttons are in the top bar.

> First time here? You can request an account yourself from the login screen: click **"Request Access / Sign Up"** and fill the form. An admin will approve it and create your login. The login screen also has **Remember me** and **Show password** options, and in demo mode seeded accounts appear as one-click quick-login buttons below the form.

---

## User Credentials

| Username  | Password    | Role              | Name                        | District  |
|-----------|-------------|-------------------|-----------------------------|-----------|
| developer | •••••••• | Developer Admin   | Developer Admin             | Gurugram  |
| admin     | •••••••• | District Admin    | District Admin - Gurugram   | Gurugram  |
| admin2    | •••••••• | District Admin    | District Admin - Faridabad  | Faridabad |
| user      | •••••••• | General User      | General Staff               | Gurugram  |
| mhc       | •••••••• | MHC               | MHC Officer - Gurugram      | Gurugram  |
| station   | •••••••• | Station Manager   | Station Manager - Gurugram  | Gurugram  |
| fbd_user  | •••••••• | General User      | Staff - Faridabad           | Faridabad |
| fbd_mhc   | •••••••• | MHC               | MHC Officer - Faridabad     | Faridabad |

> **Passwords are not listed in this guide for security reasons.** If you do not know your password, an admin can reset it from the **Users** tab (Edit user → set a new password), or use **"Forgot Password?"** on the login screen.

---

## What Each Role Can Do

| Role                | Access                                                                                             |
|---------------------|----------------------------------------------------------------------------------------------------|
| **Developer Admin** | Full access to everything, all districts, can create/edit/delete any user, manage approvals, switch districts. |
| **District Admin**  | Full access within their own district; can manage users in that district (but cannot create Admin/Developer Admin accounts). |
| **MHC**             | Can view and record material/MHC entries within their district.                                     |
| **TSI**             | Telecom / Signals inventory operator within their district (material, inspections, allotments).     |
| **Station Manager** | Manages station-level inventory within their district.                                              |
| **Police Post**     | View / manage inventory for their post.                                                             |
| **General User**    | Browsing and viewing data for their district.                                                       |

---

## Forgot Password?

On the login screen click **"Forgot Password?"**, enter your username and registered mobile number. A request is sent to the admin, who will reset it for you.

---

## Notes

- **Keep your password private.** Never share your login with others.
- Passwords are stored securely (hashed) — not even admins can see yours.
- Please log out when finished on a shared device.
- For help or a new account, contact the system admin / developer admin.