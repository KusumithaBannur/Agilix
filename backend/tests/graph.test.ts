import { describe, expect, it } from "vitest";
import { findPath, type Edge } from "../src/graph.js";

describe("findPath",()=>{
    it("returns null when there is no edges", ()=>{

        const edges : Edge[] = [];

        const path = findPath(edges,1,2);

        expect(path).toBeNull();
    });

    it("finds a direct edge", () => {
    // Given task 1 depends on task 2
    const edges: Edge[] = [{ from: 1, to: 2 }];

    // When we look for a path from 1 to 2
    const path = findPath(edges, 1, 2);

    // Then the path is just those two tasks
    expect(path).toEqual([1, 2]);
  });

  it("finds an indirect path through other tasks", () => {
    // Given 1 depends on 3, and 3 depends on 2
    const edges: Edge[] = [
      { from: 1, to: 3 },
      { from: 3, to: 2 },
    ];

    // When we look for a path from 1 to 2
    const path = findPath(edges, 1, 2);

    // Then it goes through 3
    expect(path).toEqual([1, 3, 2]);
  });

  it("does not follow edges backwards", () => {
    // Given 2 depends on 1 (not the other way round)
    const edges: Edge[] = [{ from: 2, to: 1 }];

    // When we look for a path from 1 to 2
    const path = findPath(edges, 1, 2);

    // Then there is none, because edges only go one way
    expect(path).toBeNull();
  });

  it("returns null when the target cannot be reached", () => {
    // Given two separate chains: 1 -> 2 and 3 -> 4
    const edges: Edge[] = [
      { from: 1, to: 2 },
      { from: 3, to: 4 },
    ];

    // When we look for a path from 1 to 4
    const path = findPath(edges, 1, 4);

    // Then there is none
    expect(path).toBeNull();
  });

  it("visits shared tasks only once in a diamond shape", () => {
    // Given 1 depends on 2 and 3, and both 2 and 3 depend on 4
    const edges: Edge[] = [
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 4 },
      { from: 3, to: 4 },
    ];

    // When we look for a path to a task nobody depends on
    const path = findPath(edges, 1, 99);

    // Then it finishes and returns null
    expect(path).toBeNull();
  });

  it("does not loop forever if the graph already has a cycle", () => {
    // Given a cycle 1 -> 2 -> 1 (should never be saved, but the search must still be safe)
    const edges: Edge[] = [
      { from: 1, to: 2 },
      { from: 2, to: 1 },
    ];

    // When we look for a task outside the cycle
    const path = findPath(edges, 1, 3);

    // Then it stops and returns null instead of recursing forever
    expect(path).toBeNull();
  });

});