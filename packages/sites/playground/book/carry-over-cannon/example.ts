// How the playground lists this example. It is not part of the project.
export const example = {
    name: 'Steps of Different Sizes',
    description: 'Two cannons, each firing a ball every 250 ms, handed time in steps of the size you pick, from a fast screen\'s frame to the ticker\'s cap. Rings show where steps of 1 ms would put each ball. The cannon below carries the time left over when it fires, and keeps its balls in their rings at every step size. The one above drops it, so it fires late, and its balls stray from their rings, more as the steps grow.',
    // Long enough for both rows of balls to reach the end of their range, at a moment when none is just leaving it
    stillMs: 3100,
};
