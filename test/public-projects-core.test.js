import { describe, expect, it, vi } from "vitest";
import { createProjectFetchers } from "../lib/public-projects-core";

// Minimal fake of the Supabase query builder. `order()` resolves the chain,
// invoking the per-select responder so we can simulate column-missing errors.
function makeClient(responder) {
  const order = vi.fn();
  const builder = {
    _select: null,
    _filters: {},
    select(clause) {
      this._select = clause;
      return this;
    },
    eq(column, value) {
      this._filters[column] = value;
      return this;
    },
    order() {
      return Promise.resolve(responder(this._select, this._filters));
    }
  };
  builder.order = () => Promise.resolve(responder(builder._select, builder._filters));
  return {
    from: vi.fn(() => {
      builder._select = null;
      builder._filters = {};
      return builder;
    })
  };
}

describe("createProjectFetchers", () => {
  it("returns [] when no client is available", async () => {
    const fetchers = createProjectFetchers(() => null);
    expect(await fetchers.fetchProjects()).toEqual([]);
    expect(await fetchers.fetchProjectBySlug("x")).toBeNull();
  });

  it("maps rows and filters by slug", async () => {
    const client = makeClient((_select, filters) => ({
      data: [
        {
          id: "1",
          project_name: "Cool",
          slug: filters.slug || "cool",
          website_url: "https://cool.app"
        }
      ],
      error: null
    }));
    const fetchers = createProjectFetchers(() => client);

    const project = await fetchers.fetchProjectBySlug("cool");
    expect(project.title).toBe("Cool");
    expect(project.detailPath).toBe("/projekte/cool");
    expect(client.from).toHaveBeenCalledWith("public_projects");
  });

  it("retries with the legacy select when a modern column is missing", async () => {
    const seen = [];
    const client = makeClient((select) => {
      seen.push(select);
      if (/detail_sections/.test(select)) {
        return { data: null, error: { message: 'column "detail_sections" does not exist' } };
      }
      return { data: [{ id: "9", project_name: "Legacy", slug: "legacy" }], error: null };
    });
    const fetchers = createProjectFetchers(() => client);

    const out = await fetchers.fetchProjects();
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Legacy");
    // First the modern select, then the legacy fallback.
    expect(seen).toHaveLength(2);
    expect(/detail_sections/.test(seen[0])).toBe(true);
    expect(/detail_sections/.test(seen[1])).toBe(false);
  });
});
