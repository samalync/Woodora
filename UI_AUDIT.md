# Woodora UI/UX audit

**Status:** Step 1 only. No application code has changed. Nothing will change until the fixes are chosen.
**Date:** 5 Nov 2026, on `main` at `3e88e63`.

## The short version

The brand is good and the bones are solid: the palette mostly passes contrast, forms have real labels, and the whole customer and admin flow works. What holds the site back falls into five groups:

1. **The background photo sits behind almost everything.** It competes with the content and makes some text hard to read.
2. **Mobile admin is broken.** "Log out" falls off the top bar on all 16 mobile admin page states.
3. **Add to Cart loses the shopper's place.** It clears their filter and sends them back to the top of the page.
4. **The end of the buying flow is weak.** There's no real "thank you" moment, and mobile shoppers scroll a long way to reach the total and the main button.
5. **There's no design system yet.** That means 24 font sizes, 54 hard-coded colours and 6 button heights.

## Top 15 fixes, ranked by impact vs effort

| # | Fix | Where | Impact | Effort | IDs |
|---|-----|-------|--------|--------|-----|
| 1 | Fix the mobile admin top bar so "Log out" is on screen and pages stop scrolling sideways | All admin pages | High | Small | M1 |
| 2 | Calm the background photo: stronger cream veil, full photo only where it's safe | All public pages | High | Small | H2, A1, M3, M8 |
| 3 | One button system: same height across a row, at least 44px on phones | Everywhere | High | Small | C1, A2 |
| 4 | Fix the Mission photo band, where the quote collides with text inside a blurry photo | Mission | High | Small | P5 |
| 5 | Make the checkout steps larger, with no broken line on phones | Cart to confirmation | High | Small | B2 |
| 6 | Add a real order confirmation: thank you, what happens next, calmer Cash on Delivery status | Order page | High | Small | B4 |
| 7 | Add an error summary at the top of forms, and move focus to it | Checkout, payment, contact, register | High | Small | B3, A5 |
| 8 | Restructure the admin dashboard so what needs action comes first | Dashboard | High | Small | D1 |
| 9 | Add to Cart stays in place, with a toast and an animated cart counter | Product lists and pages | High | Medium | B1 |
| 10 | Compact the mobile cart, with the total and main button always visible | Cart | High | Medium | B5 |
| 11 | Show the mobile order summary before the form, and the total beside "Place order" | Checkout | High | Medium | B6 |
| 12 | Clean up product cards: stock shown once, stronger price, quieter "Details" | Cards | Medium | Small | P1, P2, P3 |
| 13 | Stronger input borders and a focus ring that works on every background | All forms and dark areas | Medium | Small | A3, A4 |
| 14 | Clearer status badges, and remove the broken image on Add Product | Orders, admin | Medium | Small | D2, D5 |
| 15 | Add the design system: type, spacing and colour variables in `:root` | Whole stylesheet | Medium | Medium | H1, H4, C2 |

**Fix 15 comes first in the work even though it's ranked last.** It has the lowest immediate visual payoff, but Step 3 requires all colours and sizes in `:root`, so the other fixes should build on it. I'd include it whatever else you choose.

**Fixes that need something from you, so they aren't in the top 15:**
- New product photography (P4). This is the biggest visual gain still available, but code can't deliver it.
- The font change (see Step 2 below).

## How this was tested

- **Pages:** I ran the real app through 110 page states at 1440x900 and 390x844, plus a few extra shots (mobile menu, focus, notifications).
- **Database:** every run used a new temporary database, which is deleted afterwards. The script stops if the server reports anything other than a local file. `db/woodora.db` has the same SHA-256 before and after, and Turso was never contacted.
- **Baseline:** `npm test` passes 20 of 20. The customer flow and admin status flow both work. There were 0 external requests and 0 broken files. The only console errors were the expected 400, 401 and 404 responses from error states I triggered on purpose.
- **Measurements:** axe-core accessibility checks, tap target sizes, horizontal overflow, image sharpness, and text contrast against the actual pixels of the photo.
- **Demo data:** I set three products to low or zero stock and added sample orders, messages and visits, so those designs could be reviewed.

**What this doesn't cover:**
- Only Chromium was used. Nothing was tested on a real iPhone or Android phone, or with a screen reader.
- Text-on-photo contrast was sampled at one scroll position, using the worst 10% of pixels behind each text element. The photo is fixed while text scrolls over it, so results change as you scroll. Treat these failures as a minimum, not a full count.
- In full-page screenshots, the seams and the photo stopping partway down come from how Chromium captures fixed backgrounds. They aren't site bugs. Use the `fold/` folders to see what a visitor really sees.

**Evidence:** `ui-before-after/before/desktop/` and `ui-before-after/before/mobile/` hold the full-page shots, each with a `fold/` folder of first-screen shots. Raw numbers are in `ui-before-after/before/_measurements.json`.

**Ratings:** Impact is how much it affects shoppers or the admin. Effort is Small (under an hour), Medium (a few hours) or Large (needs outside input or major rework).

---

## 1. Visual hierarchy and typography

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| H1 | All | 24 font sizes are declared, from 11px to 54px, including near-duplicates such as 24/25/26/27/28. Nothing sets a clear rhythm. | A type scale of about 8 steps as `:root` variables. | Medium | Medium |
| H2 | All public | The detailed wood and leaf photo sits behind all content, so cards and headings compete with it. | Keep it as atmosphere: stronger cream veil, with the full-strength photo only around the home hero. | High | Small |
| H3 | Home | Payment options are repeated in the hero points, values row and How It Works. The page is 5,061px tall on mobile. | Merge repeated messages into one trust section. Keep all links and the simulated-payment notice. | Medium | Medium |
| H4 | All | There are 90 different padding declarations, and section padding ranges from about 32px to 100px. | A spacing scale as variables, applied to sections and cards. | Medium | Medium |
| H5 | Mission, Impact | Headings are normal weight while the rest of the site uses bold, and padding is much larger. They feel like a different site. | Use the same heading styles and section spacing. Copy stays unchanged. | Medium | Small |
| H6 | Many | 12-13px text is widely used for table headers, badges and stock labels, with 3px letter-spacing on 12px capitals. | Minimum 13px for labels and less letter-spacing. | Medium | Small |
| H7 | Messages, Privacy, Mission, admin tips | Lines run long: about 135 characters on Messages, 99 in admin tips, 88-100 on Privacy. | Limit reading text to about 70 characters per line. | Low | Small |

## 2. Consistency

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| C1 | All | `<button>` doesn't inherit line height but `<a class="btn">` does. So **Add to Cart (32px) is shorter than Details (38px)**, and Delete (32px) is shorter than Edit (38px). Button heights across the site: 32, 38, 41, 44, 48 and 56. | Set line height on `.btn` and use three height variables. | High | Small |
| C2 | All | 143 hard-coded colour uses (54 distinct) sit outside `:root`, so the theme can't be edited in one place. | Move them to named variables. Palette stays the same. | Medium | Medium |
| C3 | Home, Mission, Impact | Dark bands use neutral black (`#191919`, `#1d1d1d`) next to the espresso brown footer. | Use espresso for all of them. | Medium | Small |
| C4 | All | 18 different border-radius values. | Three radius variables plus the pill shape. | Low | Small |
| C5 | Admin Visitors | Stat cards lift on hover like links, but can't be clicked. | Lift only the cards that are links. | Low | Small |
| C6 | Orders, Visitors | Three date formats are in use. Order pages show raw UTC (`2026-11-05 10:57:49`) while Visitors shows Rwanda time, so **the same moment appears two hours apart in the admin area**. | One display format in Rwanda time. Stored data is unchanged. | Medium | Small |
| C7 | Admin orders | Admin shows raw codes (MOMO, CARD, COD) while customers see "Mobile Money (simulated)". | Show the readable name. Stored codes are unchanged. | Medium | Small |
| C8 | Header | The cart shows a bold gold "0" badge when empty, which reads as a notification. | Show the badge only when the count is above 0. | Low | Small |

## 3. Product presentation

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| P1 | Cards | Stock is stated twice per card ("In stock" and "25 available"). Sold-out items say it three times. | One stock tag on the image, with the exact count only when low. | Medium | Small |
| P2 | Cards | Price has little emphasis. On phones, prices don't line up across a row when one title wraps to two lines. | Larger price with aligned digits, pinned to a consistent position. | Medium | Small |
| P3 | Cards | "Details" competes with Add to Cart, even though the title and image already link to the same page. On phones the two buttons stack and make cards tall. | Keep the link but make it a quiet text link, so Add to Cart is the clear action. | Medium | Small |
| P4 | Catalogue | Photos don't match: white studio, dark marble and busy scenes. Some contain vendor marks: "Double End Small Rolling Pin" text on `kitchen-tools.jpeg`, a small logo on `cutting-board.jpeg`, and a brand mark on `knife-holder.jpeg`. | **Needs new photos from you.** Until then, code can only give images a consistent frame. | High | Large |
| P5 | Mission | The craft band stretches a 225x225 photo 4.4 times to 1000x390. It's blurry, and the white quote runs across the photo's own "Double End Rolling Pin" text at about 2.5:1 contrast. | Use a sharper existing photo with a dark overlay, or a solid espresso band with the quote. | High | Small |
| P6 | Home | `serving-tray.jpeg` (226x223) is shown at 381x381, 1.7 times its size, so it looks soft. | A sharper replacement is best. Until then, display it smaller. | Medium | Small |
| P7 | Product, mobile | Add to Cart falls just below the first screen because the square photo takes so much room. | Use a shorter image ratio on phones. | Medium | Small |
| P8 | Sold-out product | No next step: it says "Out of stock" with only a small back link. | Add a button to that product's category, using the existing URL. | Medium | Small |

## 4. The buying flow

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| B1 | Product lists | **Measured:** Add to Cart from `/products?category=1` lands on `/products`. Scroll position goes from 905 to 0 on desktop and 1288 to 0 on mobile. The filter and place are both lost. | Submit the same form in the background with JavaScript, then show a toast and animate the counter. No server changes. Without JavaScript it works exactly as today. | High | Medium |
| B2 | Cart to order | The step indicator is small (26px circles, 14px text). On phones "4 Done" wraps to its own line with a stray dash. | Larger steps with a connected progress line that fits on one row at 390px. | High | Small |
| B3 | Checkout and forms | **Measured:** after a failed submit, keyboard focus stays on the page body. No summary says what went wrong. The inline errors themselves look good. | An error summary at the top linking to each field, with focus moved to it. Server checks are unchanged. | High | Small |
| B4 | Order confirmation | Success is a dismissible message above "Order #1". For Cash on Delivery, "Done" sits beside "Order: Pending" and a pink "Payment: Unpaid", which looks like a problem. | A confirmation panel: thank you, order number, what happens next. Pay-on-delivery shown as expected, not as an alarm. | High | Small |
| B5 | Cart, mobile | Each item stacks into a table-like card with repeated labels. Three items make a 2,349px page, and the Checkout button is far down. | Compact rows and a sticky bar with the total and the checkout button. | High | Medium |
| B6 | Checkout, mobile | The order summary comes after the whole form on a 2,794px page, so the total isn't visible near "Place order". | A collapsible summary at the top, and the total beside the button. | High | Medium |
| B7 | Cart to login | Guests only learn they need an account after pressing Proceed, then land on a red "Please log in to continue". | A note in the cart: "You'll log in or create an account next". | Medium | Small |
| B8 | Checkout | Name and address fields lack autofill hints, which slows down mobile entry. | Add `autocomplete` and `inputmode`. Names and validation are unchanged. Card fields stay as they are. | Medium | Small |
| B9 | Checkout | Placeholders such as "Kigali" look already filled in, and they vanish when typing. | Move examples into hint text under the label. | Medium | Small |
| B10 | Place order, Pay | No feedback after pressing the button, so people may press again. | A "Placing order..." state. Must be built so the form still sends the same data. | Medium | Small |
| B11 | Cart | Pressing minus at quantity 1 removes the item with no message. | At quantity 1, show a clear remove icon and label. Server behaviour stays the same. | Medium | Small |
| B12 | Empty states | The empty cart and no-orders pages work but are plain. | A warmer message and a next action, for example category links. | Medium | Small |
| B13 | Checkout | The cart shows "Delivery fee: Free (demo)" but the checkout summary doesn't. | Show the same line in both. | Low | Small |

## 5. Mobile

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| M1 | All admin | **Measured:** the top bar is 445px wide on a 390px screen on all 16 mobile admin states. "Log out" lands on the cream page background at 1.16:1 contrast, so it's nearly invisible and only 16px tall. The notifications panel is clipped too. | Wrap or shorten the bar, using icons on phones. | High | Small |
| M2 | Admin menu | Only 3 of the 6 sections are visible, with no hint that the row scrolls. | Fade the edge to show it scrolls, or wrap to two rows. | Medium | Small |
| M3 | Home, product | The section title and description sit in separate rounded boxes, as a workaround for the photo. Looks patchy. | Remove them once the veil is fixed (H2). | Medium | Small |
| M4 | All public | The simulated-payment bar takes two lines. | Shorter wording on phones. It stays visible. | Low | Small |
| M5 | Products | The search placeholder is cut off ("Search bowls, spoons, tra"). | Shorter placeholder. | Low | Small |
| M6 | First visit | The cookie notice covers about a quarter of the first screen on every page until answered, including cart and checkout. | A more compact layout. Wording and behaviour stay the same. | Medium | Small |
| M7 | Admin products | 13 products become a long stack of label-and-value rows. | Compact rows with the image, name, price and stock together. | Medium | Medium |
| M8 | All public | `background-attachment: fixed` is known to be unreliable on iOS Safari. I couldn't confirm this here without a real device. | Use a fixed background layer instead, which is the standard workaround. | Medium | Small |

## 6. Admin usability

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| D1 | Dashboard | Six equal cards in a 4+2 layout that leaves a gap. Revenue wraps onto two lines. Things needing action don't stand out. | Pending orders and low stock first, revenue emphasised, the rest quieter, no gaps. | High | Small |
| D2 | Orders, dashboard | Two badges on every row, and a pink "Unpaid" even when that's normal for Cash on Delivery. | Clearer badges with a status dot, keeping alarm colours for real problems. Status values are unchanged. | Medium | Small |
| D3 | Dashboard, products | "Low stock" links to the full product list, with nothing marking the low items. | Tint low-stock and sold-out rows. | Medium | Small |
| D4 | Tables | Row hover is barely visible (`#fbf6ec` on white) and numbers don't line up. | Stronger hover and aligned digits. | Medium | Small |
| D5 | Add Product | **A broken image icon appears before an image is chosen.** The CSS rule `img { display: block }` overrides the `hidden` attribute. | One CSS rule so `hidden` works. | Medium | Small |
| D6 | Empty admin pages | "No orders found." and similar messages have no explanation or next step. | Say why it's empty and what to do. | Medium | Small |
| D7 | Admin order | Phone and email are plain text, and status badges sit far from the status form. | Add `tel:` and `mailto:` links, and move the badges next to the form. | Medium | Small |

## 7. Accessibility

**Already good, keep as is:** button text (white on gold, 5.23:1), muted text (6.47:1), stock colours (5.1:1 and above), the skip link, form labels, and alt text (decorative images are correctly empty, product images are named). A reduced-motion rule already exists.

| ID | Page | What's wrong | Proposed fix | Impact | Effort |
|----|------|--------------|--------------|--------|--------|
| A1 | Public pages | Text on the photo fails AA in 24 of 458 samples. Axe couldn't judge the 328 elements that need a manual contrast check, mostly because of the photo. Worst cases: breadcrumb 1.68:1, sign-in eyebrow text 2.02:1, "13 products found" 2.34:1, section descriptions 2.44:1, category tile text 1.89:1 on mobile. | The veil fix (H2) solves most of these. Stronger gradient on category tiles. | High | Small |
| A2 | All, mainly phones | Tap targets below 44px on phones: Add to Cart 32, Remove and Delete 32, Details and quantity buttons 38, filter pills 40, dismiss message 22, footer links 22, admin Log out 16. | Minimum 44px on phones, using padding so layouts barely shift. | High | Small |
| A3 | All forms | Input borders are 1.89:1 against white. Fields need 3:1 to be clearly visible. | A darker border colour. | Medium | Small |
| A4 | Dark areas, inputs | The gold focus ring is fine on cream (4.39:1) and just passes on espresso (3.07:1), but fails on the active admin menu item (1.76:1). Text inputs remove the outline and rely on a faint 20% ring. | One two-tone focus ring variable that works on every background. | Medium | Small |
| A5 | Forms | Hints aren't linked to their inputs. Textarea, select and payment method errors aren't linked to their fields. | Add the `aria-describedby` and `aria-invalid` links. | Medium | Small |
| A6 | Most pages | Headings jump from H1 to H3 in 44 states (cards and footer). Login pages have H2 before H1. | Correct the levels. Appearance stays the same. | Medium | Small |
| A7 | All | `scroll-behavior: smooth` isn't covered by the reduced-motion rule. | Add it. | Low | Small |
| A8 | Various | Smaller axe findings: admin logo's name doesn't match its visible text (32 states), simulated-payment bar outside a landmark (78), empty table headers (4), two unnamed `<aside>` areas (4), invalid `aria-label` on the quantity number. | Fix together as one tidy-up. | Low | Small |

---

## Step 2: your ideas, and whether each one helps

| Idea | Verdict | Why |
|------|---------|-----|
| Type scale and spacing variables | **Yes** | Required by Step 3 in any case (fix 15). |
| Nicer product cards | **Yes** | Fix 12, plus a button fix. The hover lift and square images already exist, so I'd keep those. |
| Toast and animated cart counter | **Yes** | Fix 9. It also solves the lost-place problem, which is the bigger gain. |
| Better empty states | **Yes, small** | They already have a next action, so this is polish (B12, D6). |
| Stronger hero and trust section | **Partly** | The hero already works. I'd merge the repeated trust messages (H3) and keep the simulated notice visible. A hero redesign would add little. |
| Cleaner checkout | **Yes** | Fixes 5, 7 and 11. Grouped fields and inline error styling are already good, so I'd keep them. |
| More readable admin dashboard | **Yes** | Fixes 8 and 14, plus D4. |
| Subtle motion | **Keep what's there** | Existing motion is already restrained. Only add the toast and counter, and close the gap in A7. |
| Self-hosted fonts | **Optional, your call** | See below. |

### Font option

Today's pairing is Georgia and Arial, which uses no downloads and looks fine. A better pairing would add polish, but it's the least urgent item here.

**My recommendation if you want it: Lora for headings and Source Sans 3 for text.** Lora keeps the warm serif feel, and Source Sans is very readable at small sizes.

| Option | Files (Latin subset, WOFF2) | Added to `public/` |
|--------|-----------------------------|--------------------|
| **Recommended** | Lora 600, Source Sans 3 at 400, 600 and 700 | **68,876 bytes (about 69 KB)** |
| Lighter | Lora 600, Source Sans 3 at 400 and 700 | 53,208 bytes (about 53 KB) |

These are measured file sizes from the `@fontsource` packages, and both fonts use the open OFL-1.1 licence. No external requests would be involved, and nothing has been added to the project yet.

---

## Noticed, but outside this visual pass

These would change server behaviour, so I've left them out unless you say otherwise:

- **Registering loses the way back to checkout.** A guest sent to login who chooses "Create an account" lands on `/products` after registering, not `/checkout`. Their cart is kept, but they have to find their way back. Fixing it means a change in `routes/auth.js`.
- **Shoppers see an Admin Login option.** The header's "Log in" link goes to a page giving Admin Login equal space with Customer Login, and the footer links to it too. The URLs would stay if the admin option were made smaller. That's visual, so I can do it if you want.
- **"Order: Paid" and "Payment: Paid" overlap.** Keeping the two statuses separate is deliberate in your schema, so I'd only restyle the badges (D2).
