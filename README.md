# Antagning Timeline Extension

This project contains a JavaScript extension that adds a timeline view to the Antagning website. The timeline displays course information organized by academic terms, allowing users to see courses over the term period along with total credit points (hp) per term.

## Features

- **Timeline Container Initialization**: Creates a dedicated container for the timeline display if one does not already exist.
- **Term-Based Timeline Grids**: Automatically creates and manages timeline grids for each term based on course information.
- **Dynamic Course Addition**: Courses are dynamically added to the timeline, which calculates their duration and visual position based on the course credit points (hp) and the studietakt (course pace).
- **Legend and Week Indicators**: A legend at the bottom displays color-coded course progress, and week indicators map the timeline to academic weeks.


![image](https://github.com/user-attachments/assets/2ac20d6a-5346-4228-a7b4-ef0a204e5471)



## Usage

1. **Installation**
   - Clone or download the project into your working directory.

2. **Integration**
   - This extension is designed to work on the Antagning website. It should be included via the website's manifest or as an injected script.
   - The script calls `initializeTimeline` on page load to set up the timeline container and attach event listeners for course selection.

3. **Customization**
   - The timeline behavior can be adjusted by modifying the parameters in the code, such as the term start/end weeks defined in the `termInfo` object.
   - CSS styles for the timeline can be adjusted directly in the script or in accompanying style files if separated.

## Files

- **timeline.js**: Contains the main logic for initializing the timeline container, handling course additions, and updating the timeline grid with course details.
- **README.md**: Provides an overview of the project, features, and usage instructions.

## Troubleshooting

- **Timeline Container Missing**: The script logs an error if the timeline container cannot be found. Ensure that the target element exists on the page or adjust the selector in `initializeTimelineContainer`.
- **Term Information Extraction**: If courses are not appearing correctly, check that the term and year extraction logic in `extractTermInfo` matches the website's course details format.

## Contributing

Feel free to fork this repository and submit pull requests. Any improvements on error handling, performance optimizations, or feature enhancements are welcome.

## License

This project is for internal use. If redistributed, please ensure proper credit is provided.
