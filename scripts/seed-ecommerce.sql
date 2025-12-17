-- Seed data for TestCase Pro - Ecommerce Test Cases
-- Created: 2024-12-17

-- Create demo user
INSERT OR IGNORE INTO users (email, password_hash, full_name) 
VALUES ('qa@testcasepro.com', '$argon2id$v=19$m=65536,t=3,p=4$salt$hash', 'QA Engineer');

-- Create folder structure
INSERT OR IGNORE INTO folders (id, name, parent_id, project_name) VALUES (1, 'Ecommerce App', NULL, 'Default');
INSERT OR IGNORE INTO folders (id, name, parent_id, project_name) VALUES (2, 'Authentication', 1, 'Default');
INSERT OR IGNORE INTO folders (id, name, parent_id, project_name) VALUES (3, 'Login Tests', 2, 'Default');
INSERT OR IGNORE INTO folders (id, name, parent_id, project_name) VALUES (4, 'Order Management', 1, 'Default');
INSERT OR IGNORE INTO folders (id, name, parent_id, project_name) VALUES (5, 'Place Order', 4, 'Default');

-- Create tags
INSERT OR IGNORE INTO tags (id, name) VALUES (1, 'Smoke');
INSERT OR IGNORE INTO tags (id, name) VALUES (2, 'Regression');
INSERT OR IGNORE INTO tags (id, name) VALUES (3, 'Critical');
INSERT OR IGNORE INTO tags (id, name) VALUES (4, 'UI');
INSERT OR IGNORE INTO tags (id, name) VALUES (5, 'E2E');
INSERT OR IGNORE INTO tags (id, name) VALUES (6, 'Negative');

-- =============================================
-- LOGIN TEST CASES (8 Test Cases)
-- =============================================

-- TC1: Login with Customer - Valid Credentials
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (1, 'Login with Customer Valid Credentials', 
'Verify that a registered customer can successfully login with valid email and password and is redirected to the homepage with their account accessible.',
'1. User has a registered customer account
2. Application is accessible
3. User is on the login page',
'High', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(1, 1, 'Navigate to the application URL (https://ecommerce-app.com)', 'Homepage loads successfully with login/signup options visible in header'),
(1, 2, 'Click on the "Sign In" button in the header navigation', 'Login page is displayed with email and password fields, "Sign In" button, and "Forgot Password" link'),
(1, 3, 'Enter valid registered email: customer@test.com', 'Email is accepted and displayed in the email field'),
(1, 4, 'Enter valid password: Test@123', 'Password is masked with dots/asterisks in the password field'),
(1, 5, 'Click the "Sign In" button', 'Loading indicator appears briefly'),
(1, 6, 'Verify successful login', 'User is redirected to homepage. Header shows user name/icon instead of "Sign In". Welcome message or user dashboard is accessible');

-- TC2: Login with Customer - Invalid Password
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (2, 'Login with Customer Invalid Password', 
'Verify that login fails when customer enters incorrect password and appropriate error message is displayed.',
'1. User has a registered customer account
2. Application is accessible
3. User is on the login page',
'High', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(2, 1, 'Navigate to the application URL (https://ecommerce-app.com)', 'Homepage loads successfully'),
(2, 2, 'Click on the "Sign In" button in the header navigation', 'Login page is displayed with email and password fields'),
(2, 3, 'Enter valid registered email: customer@test.com', 'Email is accepted and displayed in the email field'),
(2, 4, 'Enter invalid password: WrongPassword123', 'Password is masked in the password field'),
(2, 5, 'Click the "Sign In" button', 'Form submission is attempted'),
(2, 6, 'Verify error handling', 'Error message "Invalid email or password" is displayed. User remains on login page. Password field is cleared. No sensitive information is exposed');

-- TC3: Login with Customer - Invalid Email Format
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (3, 'Login with Customer Invalid Email Format', 
'Verify that login form validates email format and prevents submission with invalid email.',
'1. Application is accessible
2. User is on the login page',
'Medium', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(3, 1, 'Navigate to the login page', 'Login page is displayed'),
(3, 2, 'Enter invalid email format: customertest.com (missing @)', 'Email is entered in the field'),
(3, 3, 'Enter any password: Test@123', 'Password is masked'),
(3, 4, 'Click the "Sign In" button', 'Form validation is triggered'),
(3, 5, 'Verify validation message', 'Inline validation error appears: "Please enter a valid email address". Form is not submitted');

-- TC4: Login with Customer - Empty Fields
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (4, 'Login with Customer Empty Fields Validation', 
'Verify that login form prevents submission when required fields are empty.',
'1. Application is accessible
2. User is on the login page',
'Medium', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(4, 1, 'Navigate to the login page', 'Login page is displayed with empty form fields'),
(4, 2, 'Leave email field empty', 'Email field remains empty'),
(4, 3, 'Leave password field empty', 'Password field remains empty'),
(4, 4, 'Click the "Sign In" button', 'Form validation is triggered'),
(4, 5, 'Verify validation messages', 'Validation errors appear for both fields: "Email is required" and "Password is required". Form is not submitted');

-- TC5: Login with Customer - Remember Me Functionality
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (5, 'Login with Customer Remember Me Functionality', 
'Verify that "Remember Me" checkbox persists user session across browser restarts.',
'1. User has a registered customer account
2. Application is accessible
3. Browser cookies are enabled',
'Low', 'Under Review', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(5, 1, 'Navigate to the login page', 'Login page is displayed with "Remember Me" checkbox'),
(5, 2, 'Enter valid email: customer@test.com', 'Email is entered'),
(5, 3, 'Enter valid password: Test@123', 'Password is entered'),
(5, 4, 'Check the "Remember Me" checkbox', 'Checkbox is selected/checked'),
(5, 5, 'Click the "Sign In" button', 'User is logged in successfully'),
(5, 6, 'Close the browser completely', 'Browser is closed'),
(5, 7, 'Reopen browser and navigate to application URL', 'User is still logged in without needing to re-enter credentials');

-- TC6: Login with Admin - Valid Credentials
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (6, 'Login with Admin Valid Credentials', 
'Verify that an admin user can successfully login and access admin dashboard.',
'1. Admin account exists in the system
2. Application is accessible',
'High', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(6, 1, 'Navigate to the admin login URL (https://ecommerce-app.com/admin)', 'Admin login page is displayed'),
(6, 2, 'Enter admin email: admin@ecommerce.com', 'Email is entered in the field'),
(6, 3, 'Enter admin password: Admin@123', 'Password is masked'),
(6, 4, 'Click the "Sign In" button', 'Login is processed'),
(6, 5, 'Verify admin dashboard access', 'Admin is redirected to admin dashboard. Dashboard shows admin menu: Products, Orders, Users, Analytics, Settings');

-- TC7: Login with Customer - Account Lockout
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (7, 'Login with Customer Account Lockout After Failed Attempts', 
'Verify that account gets locked after 5 consecutive failed login attempts for security.',
'1. User has a registered customer account
2. Account is not currently locked
3. Application is accessible',
'High', 'Baselined', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(7, 1, 'Navigate to the login page', 'Login page is displayed'),
(7, 2, 'Enter valid email: customer@test.com', 'Email is entered'),
(7, 3, 'Enter wrong password: Wrong1 and click Sign In', 'Error: "Invalid email or password" (Attempt 1)'),
(7, 4, 'Enter wrong password: Wrong2 and click Sign In', 'Error: "Invalid email or password" (Attempt 2)'),
(7, 5, 'Enter wrong password: Wrong3 and click Sign In', 'Error: "Invalid email or password" (Attempt 3)'),
(7, 6, 'Enter wrong password: Wrong4 and click Sign In', 'Warning: "1 attempt remaining before account lockout"'),
(7, 7, 'Enter wrong password: Wrong5 and click Sign In', 'Account locked message: "Account locked due to multiple failed attempts. Please try again in 30 minutes or reset your password"');

-- TC8: Login with Customer - Password Visibility Toggle
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (8, 'Login with Customer Password Visibility Toggle', 
'Verify that password visibility can be toggled using the eye icon.',
'1. Application is accessible
2. User is on the login page',
'Low', 'Draft', 0, 3, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(8, 1, 'Navigate to the login page', 'Login page is displayed'),
(8, 2, 'Enter password: Test@123', 'Password is masked (shown as dots/asterisks)'),
(8, 3, 'Click the eye icon next to password field', 'Password is now visible as plain text: "Test@123". Eye icon changes to "eye-off" icon'),
(8, 4, 'Click the eye icon again', 'Password is masked again. Eye icon reverts to original state');

-- =============================================
-- PLACE ORDER TEST CASES (12 Test Cases)
-- =============================================

-- TC9: Place Order - Complete Guest Checkout
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (9, 'Login with Guest Complete Order Placement', 
'Verify that a guest user can successfully browse products, add to cart, and complete checkout without creating an account.',
'1. Application is accessible
2. Products are available in inventory
3. Payment gateway is operational',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(9, 1, 'Navigate to the application homepage', 'Homepage loads with product categories and featured products visible'),
(9, 2, 'Click on "Electronics" category from navigation menu', 'Electronics category page displays with available products'),
(9, 3, 'Click on a product: "Wireless Bluetooth Headphones"', 'Product detail page opens showing name, price ($49.99), description, images, and "Add to Cart" button'),
(9, 4, 'Select quantity: 2', 'Quantity selector shows "2"'),
(9, 5, 'Click "Add to Cart" button', 'Success message: "Added to cart". Cart icon in header shows "2" items'),
(9, 6, 'Click on cart icon in header', 'Cart page/drawer opens showing: Wireless Bluetooth Headphones x2 = $99.98'),
(9, 7, 'Click "Proceed to Checkout" button', 'Checkout page loads with shipping information form'),
(9, 8, 'Select "Continue as Guest" option', 'Guest checkout form is displayed'),
(9, 9, 'Fill shipping details: Name: John Doe, Address: 123 Main St, City: New York, ZIP: 10001, Phone: 555-1234', 'All fields are filled and validated'),
(9, 10, 'Click "Continue to Payment"', 'Payment page loads with order summary'),
(9, 11, 'Enter card details: 4111111111111111, Exp: 12/25, CVV: 123', 'Card details are entered and validated'),
(9, 12, 'Click "Place Order" button', 'Order confirmation page displays with order number, estimated delivery, and email confirmation message');

-- TC10: Place Order - Registered Customer Checkout
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (10, 'Login with Customer Complete Order with Saved Address', 
'Verify that a logged-in customer can place order using saved address and payment method.',
'1. Customer account exists with saved address and payment method
2. Customer is logged in
3. Products are available',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(10, 1, 'Login with Customer credentials (customer@test.com / Test@123)', 'User is logged in and redirected to homepage'),
(10, 2, 'Search for "Running Shoes" in search bar', 'Search results page shows matching products'),
(10, 3, 'Click on "Nike Air Max Running Shoes"', 'Product detail page displays with size and color options'),
(10, 4, 'Select Size: 10, Color: Black', 'Options are selected and reflected in product display'),
(10, 5, 'Click "Add to Cart"', 'Product added to cart. Cart shows 1 item'),
(10, 6, 'Click "Proceed to Checkout"', 'Checkout page loads with saved addresses displayed'),
(10, 7, 'Select saved address: "Home - 123 Main St, New York"', 'Address is selected and highlighted'),
(10, 8, 'Click "Continue to Payment"', 'Payment page shows saved payment methods'),
(10, 9, 'Select saved card ending in 4242', 'Card is selected'),
(10, 10, 'Review order summary: Product, Shipping, Tax, Total', 'Order summary is accurate with correct calculations'),
(10, 11, 'Click "Place Order"', 'Order confirmation displayed. Order appears in customer order history');

-- TC11: Place Order - Apply Coupon Code
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (11, 'Login with Customer Apply Valid Coupon Code', 
'Verify that a valid coupon code applies discount correctly during checkout.',
'1. Customer is logged in
2. Valid coupon code "SAVE20" exists (20% off)
3. Cart has eligible products',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(11, 1, 'Login with Customer and add product ($100) to cart', 'Product in cart, subtotal shows $100.00'),
(11, 2, 'Navigate to cart page', 'Cart page displays with coupon code input field'),
(11, 3, 'Enter coupon code: SAVE20', 'Coupon code is entered in the field'),
(11, 4, 'Click "Apply" button', 'Coupon is validated'),
(11, 5, 'Verify discount application', 'Discount line shows: "SAVE20 (-20%): -$20.00". New subtotal: $80.00. Success message: "Coupon applied successfully"'),
(11, 6, 'Proceed to checkout and complete order', 'Order total reflects discounted amount throughout checkout');

-- TC12: Place Order - Invalid Coupon Code
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (12, 'Login with Customer Apply Invalid Coupon Code', 
'Verify that invalid or expired coupon code shows appropriate error message.',
'1. Customer is logged in
2. Cart has products',
'Medium', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(12, 1, 'Login with Customer and add product to cart', 'Product in cart'),
(12, 2, 'Navigate to cart page', 'Cart page displays'),
(12, 3, 'Enter invalid coupon code: INVALIDCODE', 'Code is entered'),
(12, 4, 'Click "Apply" button', 'Coupon validation attempted'),
(12, 5, 'Verify error message', 'Error message: "Invalid coupon code". Original price remains unchanged');

-- TC13: Place Order - Empty Cart Checkout Prevention
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (13, 'Login with Customer Checkout with Empty Cart', 
'Verify that user cannot proceed to checkout with an empty cart.',
'1. Customer is logged in
2. Cart is empty',
'Medium', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(13, 1, 'Login with Customer credentials', 'User is logged in'),
(13, 2, 'Click on cart icon', 'Cart drawer/page opens'),
(13, 3, 'Verify cart is empty', 'Message displayed: "Your cart is empty"'),
(13, 4, 'Attempt to click "Proceed to Checkout"', 'Button is disabled or shows message: "Add items to cart to checkout". Link to "Continue Shopping" is available');

-- TC14: Place Order - Out of Stock Product
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (14, 'Login with Customer Add Out of Stock Product', 
'Verify that out of stock products cannot be added to cart.',
'1. Customer is logged in
2. Product is marked as out of stock',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(14, 1, 'Login with Customer credentials', 'User is logged in'),
(14, 2, 'Navigate to a product that is out of stock', 'Product page loads'),
(14, 3, 'Verify out of stock indication', '"Out of Stock" badge is displayed. "Add to Cart" button is disabled or replaced with "Notify Me"'),
(14, 4, 'Attempt to add product via URL manipulation', 'Server-side validation prevents adding. Error: "Product is currently unavailable"');

-- TC15: Place Order - Update Cart Quantity
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (15, 'Login with Customer Update Cart Quantity', 
'Verify that cart quantity can be updated and totals recalculate correctly.',
'1. Customer is logged in
2. Product is in cart',
'Medium', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(15, 1, 'Login with Customer and add product ($25) to cart', 'Cart shows 1 item, subtotal: $25.00'),
(15, 2, 'Navigate to cart page', 'Cart page displays with quantity selector'),
(15, 3, 'Increase quantity to 3 using + button or input', 'Quantity updates to 3'),
(15, 4, 'Verify price recalculation', 'Subtotal updates to $75.00 (3 x $25)'),
(15, 5, 'Decrease quantity to 2', 'Quantity updates to 2, subtotal: $50.00'),
(15, 6, 'Proceed to checkout', 'Checkout reflects updated quantity and price');

-- TC16: Place Order - Remove Item from Cart
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (16, 'Login with Customer Remove Item from Cart', 
'Verify that items can be removed from cart with confirmation.',
'1. Customer is logged in
2. Multiple products in cart',
'Medium', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(16, 1, 'Login with Customer with 2 products in cart', 'Cart shows 2 items'),
(16, 2, 'Navigate to cart page', 'Both products displayed with remove (X or trash) icons'),
(16, 3, 'Click remove icon on first product', 'Confirmation prompt: "Remove this item from cart?"'),
(16, 4, 'Confirm removal', 'Product is removed. Cart updates to show 1 item. Total recalculates'),
(16, 5, 'Verify undo option', 'Toast message with "Undo" option appears briefly');

-- TC17: Place Order - Shipping Method Selection
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (17, 'Login with Customer Select Different Shipping Methods', 
'Verify that different shipping methods display correct prices and estimated delivery dates.',
'1. Customer is logged in
2. Product in cart
3. Multiple shipping options available',
'Medium', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(17, 1, 'Login with Customer and proceed to checkout with product in cart', 'Checkout page loads'),
(17, 2, 'Fill shipping address', 'Address is validated'),
(17, 3, 'View available shipping options', 'Options displayed: Standard (Free, 5-7 days), Express ($9.99, 2-3 days), Next Day ($19.99, 1 day)'),
(17, 4, 'Select "Express Shipping"', 'Shipping cost updates to $9.99. Estimated delivery date shown'),
(17, 5, 'Change to "Next Day Delivery"', 'Shipping cost updates to $19.99. Delivery date updates to next business day'),
(17, 6, 'Verify total calculation', 'Order total = Product price + Selected shipping cost');

-- TC18: Place Order - Payment Declined
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (18, 'Login with Customer Payment Card Declined', 
'Verify appropriate handling when payment card is declined.',
'1. Customer is logged in
2. Product in cart
3. Test card number for decline scenario',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(18, 1, 'Login with Customer and proceed to payment page', 'Payment page loads'),
(18, 2, 'Enter test declined card: 4000000000000002', 'Card number entered'),
(18, 3, 'Enter expiry: 12/25 and CVV: 123', 'Card details completed'),
(18, 4, 'Click "Place Order"', 'Payment processing indicator shown'),
(18, 5, 'Verify decline handling', 'Error message: "Payment declined. Please try a different payment method." User remains on payment page. Order is not created. Cart is preserved');

-- TC19: Place Order - Order Confirmation Email
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (19, 'Login with Customer Verify Order Confirmation Email', 
'Verify that order confirmation email is sent with correct order details.',
'1. Customer is logged in
2. Order placed successfully
3. Email service is operational',
'Medium', 'Under Review', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(19, 1, 'Login with Customer and complete an order', 'Order confirmation page displayed with order #12345'),
(19, 2, 'Check registered email inbox', 'Email received from orders@ecommerce.com'),
(19, 3, 'Verify email subject', 'Subject: "Order Confirmation - #12345"'),
(19, 4, 'Verify email content', 'Email contains: Order number, Items ordered with quantities and prices, Shipping address, Estimated delivery date, Order total, Customer support contact'),
(19, 5, 'Click "View Order" link in email', 'Link opens order details page in browser (user may need to login)');

-- TC20: Place Order - Multiple Items Different Categories
INSERT INTO test_cases (id, title, description, pre_conditions, priority, status, is_automated, folder_id, author_id)
VALUES (20, 'Login with Customer Order Multiple Items from Different Categories', 
'Verify that customer can add and purchase items from multiple categories in a single order.',
'1. Customer is logged in
2. Products available in multiple categories',
'High', 'Baselined', 0, 5, 1);

INSERT INTO test_case_steps (test_case_id, step_number, action, expected_result) VALUES
(20, 1, 'Login with Customer credentials', 'User logged in successfully'),
(20, 2, 'Navigate to Electronics and add "USB-C Cable" ($15) to cart', 'Item added, cart shows 1 item'),
(20, 3, 'Navigate to Clothing and add "Cotton T-Shirt" ($25) to cart', 'Item added, cart shows 2 items'),
(20, 4, 'Navigate to Books and add "JavaScript Guide" ($35) to cart', 'Item added, cart shows 3 items'),
(20, 5, 'Open cart and verify all items', 'All 3 items displayed with correct prices. Subtotal: $75.00'),
(20, 6, 'Proceed to checkout', 'Checkout shows all items grouped or listed'),
(20, 7, 'Complete payment with valid card', 'Order placed successfully'),
(20, 8, 'Verify order confirmation', 'Order confirmation shows all 3 items with individual prices and combined total');

-- =============================================
-- TAG ASSOCIATIONS
-- =============================================

-- Login test cases tags
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (1, 1); -- Smoke
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (1, 3); -- Critical
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (2, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (2, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (3, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (4, 4); -- UI
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (5, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (6, 1); -- Smoke
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (6, 3); -- Critical
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (7, 3); -- Critical
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (7, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (8, 4); -- UI

-- Order test cases tags
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (9, 1); -- Smoke
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (9, 5); -- E2E
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (10, 1); -- Smoke
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (10, 5); -- E2E
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (11, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (12, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (13, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (14, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (14, 3); -- Critical
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (15, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (16, 4); -- UI
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (17, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (18, 3); -- Critical
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (18, 6); -- Negative
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (19, 2); -- Regression
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (20, 5); -- E2E
INSERT INTO test_case_tags (test_case_id, tag_id) VALUES (20, 1); -- Smoke

