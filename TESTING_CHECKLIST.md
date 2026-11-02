# Woodora - Feature Testing Checklist

Tick each box while testing in the browser. Start with `npm run setup` and `npm start`, then open http://localhost:3000.

## Accounts
- [ ] Register with a valid name, email and password -> you are logged in and the header shows My Orders / Log out
- [ ] Register with a bad email, short password, or different confirmation -> clear error message under each field
- [ ] Register with an email that already exists -> "account already exists" message
- [ ] Log out, then open **Log in**: the selection page shows "Customer Login" and "Admin Login" cards
- [ ] Customer Login with the same account -> you can shop and see My Orders
- [ ] Customer Login with a wrong password -> "Incorrect email or password."
- [ ] Admin Login with the administrator account -> you land on the Admin Dashboard
- [ ] Admin Login with a **customer** account -> "Access denied: this account is not an administrator"
- [ ] Customer Login with the **administrator** account -> told to use the Admin Login
- [ ] Register form has no role option; the new account can not open /admin

## Browsing
- [ ] Home page shows the logo, menu, 3 featured products and the footer with contact info (placeholders)
- [ ] Products page shows all 13 products with picture, description, RWF price and stock
- [ ] Search "bowl" -> only matching products; search for nonsense -> "No products match" message
- [ ] Filter by each of the 4 categories (Utensils 5, Bowls & Plates 3, Trays & Boards 2, Sets 3)
- [ ] Open a product's detail page

## Cart
- [ ] Add a product -> success message and the cart counter in the menu increases
- [ ] Change pages and come back -> the cart is still there
- [ ] + and - buttons change quantity; subtotal and total update
- [ ] The + button stops at the available stock; entering too many on the product page shows a message
- [ ] Remove an item; the cart shows "Your cart is empty" when it has nothing

## Checkout, payment and orders
- [ ] Checkout while logged out -> sent to login, then back to checkout
- [ ] Submit the checkout form empty -> errors on name, phone, address, city and method
- [ ] Place an order with **Mobile Money**: enter a phone -> press "I approved" -> order shows Paid / Paid
- [ ] Mobile Money: press "Decline" -> order stays Pending / Unpaid and can be paid later from My Orders
- [ ] Place an order with **Card**: wrong details show errors; `4242 4242 4242 4242`, `12/29`, `123` succeeds
- [ ] Place an order with **Cash on Delivery** -> no payment page; order is Pending / Unpaid
- [ ] The banner "simulation only" is visible on the checkout and payment pages
- [ ] My Orders lists every order with its two statuses; the order page shows items, prices and delivery details
- [ ] Stock on the product page went down after ordering

## Administrator
- [ ] Dashboard shows product, order, pending, revenue and message counts
- [ ] Add a product (new name, price, stock, category, image) -> appears on the Products page
- [ ] Try to add a product with empty name / negative price -> error messages
- [ ] Edit a product's price and stock -> change appears on the site
- [ ] Tick "featured" on a product -> it appears on the home page (home always shows up to 3)
- [ ] Delete a product (confirm dialog) -> removed from the site; old orders still show its name and price
- [ ] Orders list; filter by Pending / Paid / Delivered
- [ ] Open an order, change Order status and Payment status, Save -> change shows in the customer's My Orders
- [ ] Messages page shows contact messages

## Contact form
- [ ] Send a valid message -> success message, and it appears in Admin > Messages
- [ ] Send an invalid one -> clear errors, nothing saved

## Security
- [ ] While logged out, open http://localhost:3000/admin -> redirected to the Admin login page
- [ ] While logged in as a customer, open /admin and /admin/products -> "Access denied"
- [ ] Customer A cannot open Customer B's order page (/orders/ID) -> "not found"
- [ ] In the browser developer tools, change a price or total in the checkout form before sending -> the order still uses the real database price
- [ ] Open the database file: passwords are long `$2...` hashes, and no card number exists anywhere

## Responsive design
- [ ] Desktop (wide window): layout is tidy and the menu is in one row
- [ ] Tablet width (~800px): product grid shrinks, hamburger menu appears
- [ ] Phone width (~390px): hamburger menu works, no sideways scrolling, tables become stacked cards, buttons are easy to press
- [ ] Impact and Our Mission pages read well at all three sizes

## Invalid input handling
- [ ] Very long text in the contact message -> error, not a crash
- [ ] Open /products/9999 -> friendly "Page not found"
- [ ] Open a random address like /abc -> friendly "Page not found"
- [ ] Type `<script>alert(1)</script>` in the contact form -> shown as plain text in the admin messages, nothing runs
