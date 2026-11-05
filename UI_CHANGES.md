# Woodora UI changes

A visual and UX pass on branch `feature/ui-polish`. Every URL, form field and server-side check is unchanged, and no route or database file was edited. The stack is still EJS, plain CSS and vanilla JavaScript, with no new dependencies. See `UI_AUDIT.md` for the reasoning behind each change.

## Changes

**Theme**
- All colours, font sizes, spacing, corner radii and control heights now live as variables in `:root` at the top of `public/css/style.css`.
- Font sizes reduced from 24 to a 12-step scale, and similar colours merged, so the design looks more consistent.
- Dark bands on Home, Mission and Impact changed from neutral black to the brand espresso brown.

**Background and readability**
- A stronger cream veil now covers the background photo on all pages, and the photo shows clearly only around the home hero.
- Phone headings lost the separate rounded boxes that were a workaround for the photo.
- Category tiles have a stronger dark gradient behind their text.
- The Mission photo band uses a sharper photo under a dark overlay, so the quote is readable.

**Buttons and tap targets**
- Buttons in a row now have matching heights, using three sizes: 38, 44 and 52px.
- Everything tappable is at least 44px tall on phones and tablets (up to 1000px wide).
- Admin top bar fits on phones, using icon buttons that keep their labels for screen readers.

**Buying flow**
- Add to Cart stays on the same page, keeping the filter and scroll position, with a toast and an animated cart counter.
- Checkout steps are larger, joined by a progress line, and stay on one row on phones.
- Paid and Cash on Delivery orders open with a thank-you panel saying what happens next.
- Forms that fail validation open with a list of problems linking to each field, and keyboard focus moves there.
- The mobile cart uses compact rows, with a sticky bar showing the total and a Checkout button.
- Mobile checkout shows a fold-out order summary above the form.
- A "Total to pay" line sits above Place order on all screen sizes.

**Product cards**
- Stock appears once, as a tag on the image, with the exact count only when low.
- Price is larger and lines up across a row.
- Add to Cart is the clear action, and Details is now a quiet link to the same page.

**Forms and accessibility**
- Input borders are darker (3.9:1 against white, was 1.89:1).
- A two-tone focus ring stays visible on every background.
- Hints and errors are linked to their inputs for screen readers.
- Smooth scrolling now respects the reduced-motion setting.

**Admin**
- Dashboard leads with pending orders, low stock and revenue, in a layout with no gaps.
- Status badges have a dot, and they wrap on phones instead of being cut off.
- Add Product no longer shows a broken image before a picture is chosen.

## What the team should know to explain it

- **Toast** = the short message after Add to Cart. It's the server's own message, including stock limit errors, shown without leaving the page.
- **How Add to Cart works now** = JavaScript sends the same form to the same `/cart/add` address in the background. The server's checks are identical, and without JavaScript the form works the old way. Background requests aren't counted as visits (tested: 0 added).
- **"Payment: On delivery"** = a display label only, for a Cash on Delivery order not yet delivered. The database still stores `Unpaid`, and the admin status form still shows `Unpaid`. Once delivered, an unpaid order shows "Payment: Unpaid" again.
- **Thank-you panel** = shown on the order page for paid or Cash on Delivery orders, including when reopened later from My Orders. Delivered orders show a delivered message.
- **Error summary** = a list built from the same errors the server already returns. No new validation was added.
- **To change the theme** = edit the variables in `:root` in `public/css/style.css`. Small one-off component sizes, such as icon sizes and breakpoints, stay in their own rules.
- **Simulated payment notices** = all kept: the top bar, footer, checkout and payment page.

## Test results

Run on a temporary database, on the final code.

| Check | Before | After |
|-------|--------|-------|
| `npm test` | 20 of 20 pass | 20 of 20 pass |
| Customer flow (Mobile Money, card, Cash on Delivery) and admin order-status flow in the browser | Works | Works |
| Pages with sideways scroll at 390px | 16 of 110 page states | 0 of 110 |
| Other widths checked: 320, 360, 768, 1024, 1100px | Not measured | No sideways scroll on the 17 pages checked |
| Text on the photo below AA contrast | 24 of 458 samples | 0 of 412 real text samples |
| Axe contrast failures | 16 page states | 0 |
| Non-inline controls under 44px tall on phones | Many (Add to Cart was 32px) | 0 |
| Add to Cart from a filtered list | Filter and scroll position lost | Both kept |
| Add to Cart with JavaScript off | Works | Works |
| External requests | 0 | 0 |

## Known limits

- **Not tested on real devices:** only Chromium was used, not a real iPhone or Android phone, and no screen reader.
- **Contrast sampling:** text-on-photo contrast was sampled at one scroll position, using the worst 10% of pixels. The automated check also flags the "1 Cart" step on `/cart` because it picks up the gold number circle. That isn't a real failure.
- **Some pages got longer:** the mobile admin dashboard went from 2,247px to 2,620px, the home page from 5,061px to 5,199px on mobile, and desktop checkout from 1,604px to 1,738px. The mobile cart (2,349px to 2,178px) and mobile checkout (2,794px to 2,675px) got shorter.
- **Small accessibility items remain:** heading order, the logo's accessible name, the top bar outside a landmark, empty table headers and two unnamed `<aside>` areas. These audit items (A6, A8) weren't in the top 15.
- **Not in this pass:** the other audit items outside the top 15, such as the raw UTC dates on order pages (C6). New product photos, the font change and the registration redirect also aren't included.
