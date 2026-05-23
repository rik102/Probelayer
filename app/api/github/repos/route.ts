import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      visibility?: "all" | "private" | "public";
    };

    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "GitHub token is required" }, { status: 400 });
    }

    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("visibility", body.visibility ?? "all");

    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `GitHub request failed: ${response.status} ${text}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as GitHubRepo[];
    return NextResponse.json({
      repos: data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        htmlUrl: repo.html_url,
        description: repo.description,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}
