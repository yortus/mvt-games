/**
 * Returned by an update or refresh method to tell the scene pass to skip that
 * node's descendants this frame. The node itself has already run, so next
 * frame it runs again and can stop skipping - nothing gets permanently stuck,
 * unlike hiding a node from a scene pass that gates on visibility.
 *
 * A dedicated symbol rather than `true` so an accidental truthy return can
 * never be mistaken for it, and so the type rejects any other non-void return.
 * A registered one (`Symbol.for`), so that every copy of @mvtjs/utils in a
 * program, of any version, has the same value.
 */
export const SKIP_DESCENDANTS: unique symbol = Symbol.for('mvt.skipDescendants');
