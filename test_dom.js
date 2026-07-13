const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, 'antagning.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(htmlContent);
const document = dom.window.document;

console.log('Testing selectors on antagning.html...');

const buttons = document.querySelectorAll('button.toggleselection[data-id]');
console.log(`Found ${buttons.length} toggleselection buttons.`);

if (buttons.length === 0) {
    console.error('ERROR: No toggleselection buttons found!');
    process.exit(1);
}

// Check first button
const firstButton = buttons[0];
console.log('First button ID:', firstButton.id);
console.log('First button data-id:', firstButton.getAttribute('data-id'));

// Helper to find course element (copied from timeline.js)
function findCourseElement(element) {
    let current = element;
    while (current && !current.classList.contains('course-container')) {
        current = current.parentElement;
    }
    if (!current) {
        current = element;
        while (current && !current.querySelector('.headline4')) {
            current = current.parentElement;
        }
    }
    return current;
}

const courseElement = findCourseElement(firstButton);
if (!courseElement) {
    console.error('ERROR: Could not find course element for button!');
    process.exit(1);
}
console.log('Found course element tag:', courseElement.tagName, 'class:', courseElement.className);

// Try to extract course details
try {
    const courseId = courseElement.querySelector('button.toggleselection').getAttribute('data-id');
    const courseName = courseElement.querySelector('.headline4').textContent.trim();
    const coursePointsRaw = courseElement.querySelector('.universal_medium').textContent;
    const coursePoints = coursePointsRaw.split(',')[0].trim().replace(/[^\d.]/g, '');
    const hpValue = parseFloat(coursePoints);

    console.log('Extracted Course ID:', courseId);
    console.log('Extracted Course Name:', courseName);
    console.log('Raw Course Points text:', coursePointsRaw.trim());
    console.log('Extracted Course Points:', coursePoints);
    console.log('hpValue:', hpValue);
} catch (e) {
    console.error('ERROR extracting course details:', e.message);
    process.exit(1);
}

console.log('DOM parsing test completed successfully.');
