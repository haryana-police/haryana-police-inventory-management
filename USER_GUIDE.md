# Haryana Police Inventory App — User Guide

**App URL:** http://localhost:3210

The app runs on your own computer. Start the server (`run-local.bat`, or `npm start`); it prints the exact address to open — usually **http://localhost:3210**. If that port is busy the server picks the next free one, so always copy the `App:` line it shows.

---

## Before You Start — Opening the App

1. Open the project folder and double-click `run-local.bat` (on other systems, run `npm start`).
2. A black console window opens and must stay open. That window **is** the app server — closing it stops the app.
3. Your browser opens automatically. If it does not, look at the `App:` line in the console and open that address — it is usually **http://localhost:3210**. If that port is already in use the server picks the next free one, so always open the exact address it prints.
4. When you finish, click the console window and press **Ctrl+C** to stop the server.

> **Where your data lives:** everything is stored in one file — `local-data\db.json` in the project folder. Copy that file to back up. Delete it and restart to start fresh.

> **Using it from a phone or another computer:** start the server on the main computer, then open `http://<main computer's IP>:3210` on the other device. Find that IP by running `ipconfig` on the main computer and reading *IPv4 Address* (for example `192.168.1.5`). Both devices must be on the same office network.

---

## How to Log In

1. With the server running, open the address it printed (usually **http://localhost:3210**) in your browser.
2. Enter your **Username** and **Password** — if you are using a fresh local install, they are listed in the table below.
3. Click **Sign In**.
4. Use the menu on the left to browse Dashboard, Inventory, Consumable Items, Distribution, Item Issued, Demands, Maintenance, Inspections and Reports. The notification bell (top-right), **Users**, and **Districts** buttons are in the top bar.

> First time here? You can request an account yourself from the login screen: click **"Request Access / Sign Up"** and fill the form. An admin will approve it and create your login. The login screen also has **Remember me** and **Show password** options, and in demo mode seeded accounts appear as one-click quick-login buttons below the form.

---

## User Credentials

| Username  | Password      | Role              | Name                        | District  |
|-----------|---------------|-------------------|-----------------------------|-----------|
| developer | `dev@123`     | Developer Admin   | Developer Admin             | Gurugram  |
| admin     | `admin123`    | District Admin    | District Admin - Gurugram   | Gurugram  |
| admin2    | `admin123`    | District Admin    | District Admin - Faridabad  | Faridabad |
| user      | `user123`     | General User      | General Staff               | Gurugram  |
| mhc       | `mhc123`      | MHC               | MHC Officer - Gurugram      | Gurugram  |
| station   | `station123`  | Station Manager   | Station Manager - Gurugram  | Gurugram  |
| fbd_user  | `user123`     | General User      | Staff - Faridabad           | Faridabad |
| fbd_mhc   | `mhc123`      | MHC               | MHC Officer - Faridabad     | Faridabad |

> **These are the factory-default passwords that come with a fresh local install.** They are listed here so you can open the app on your own computer straight away.
>
> ⚠️ **Change them before you put any real data in.** Sign in as `developer`, then open **Manage ▾ → Users**, edit each account and set a new password. Passwords are stored hashed, so nobody — not even the Developer Admin — can read them back.
>
> Forgot a password? An admin can reset it from **Manage ▾ → Users** (Edit user → set a new password), or use **"Forgot Password?"** on the login screen.

---

## What Each Role Can Do

| Role                | Access                                                                                             |
|---------------------|----------------------------------------------------------------------------------------------------|
| **Developer Admin** | Manages districts, district admins and locations; can switch districts. **Read-only** on inventory data, maintenance and profiles. |
| **District Admin**  | Full access within their own district; can manage users in that district (but cannot create Admin/Developer Admin accounts). |
| **MHC**             | Can view and record material/MHC entries within their district.                                     |
| **TSI**             | Telecom / Signals inventory operator within their district (material, inspections, allotments).     |
| **Station Manager** | Manages station-level inventory within their district.                                              |
| **Staff**           | General staff of a unit; day-to-day entries within own location.                                   |
| **Computer/IT Staff** | Receives maintenance requests of type **Computer / IT** automatically.                          |
| **MTO Staff**       | Receives maintenance requests of type **Vehicle** automatically.                                   |
| **Police Post**     | View / manage inventory for their post.                                                             |
| **General User**    | Browsing and viewing data for their district.                                                       |

> **Computer/IT Staff** and **MTO Staff** accounts are created automatically for each district and are not offered in the manual role dropdown. They land straight on the Maintenance screen after logging in.

---

## Forgot Password?

On the login screen click **"Forgot Password?"**, enter your username and registered mobile number. A request is sent to the admin, who will reset it for you.

---

## Notes

- **Keep your password private.** Never share your login with others.
- Passwords are stored securely (hashed) — not even admins can see yours.
- Please log out when finished on a shared device.
- For help or a new account, contact the system admin / developer admin.