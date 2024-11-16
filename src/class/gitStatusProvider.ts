import { TransformState } from "./transformState";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import gitRepoInfo, { GitRepoInfo } from "git-repo-info";
import chalk from "chalk";

interface GitProp {
	branch: string;
	commit: string;
	isoTimestamp: string;
	unixTimestamp: number;
	latestTag: string;
}

type Nullable<T> = { [P in keyof T]: T[P] | null };

export class GitStatusProvider {
	private tracked = false;
	private dirty = false;

	private props: Partial<GitProp> = {};
	private repoInfo: Nullable<GitRepoInfo>;
	private unixTimestamp: number;

	public constructor(private state: TransformState) {
		const currentDir = this.state.program.getCurrentDirectory();
		if (fs.existsSync(path.join(currentDir, ".git"))) {
			this.tracked = true;
		}

		const gitTreeDirty = execSync("git status --porcelain").toString().trim().length > 0;
		this.dirty = gitTreeDirty;

		const repoInfo = gitRepoInfo();
		this.repoInfo = repoInfo;
		this.unixTimestamp = Math.round(
			repoInfo.authorDate ? new Date(repoInfo.authorDate).getTime() / 1000 : new Date().getTime() / 1000,
		);
	}

	public isTracked(): boolean {
		return this.tracked;
	}

	public isDirty(): boolean {
		return this.dirty;
	}

	public query<TGitQuery extends keyof GitProp>(gitQuery: TGitQuery): GitProp[TGitQuery] {
		const repoInfo = this.repoInfo;

		const prop = this.props[gitQuery];
		if (prop !== undefined) {
			return prop as GitProp[TGitQuery];
		}

		this.state.logger.infoIfVerbose("Query once: Git repository for '" + chalk.yellow(gitQuery) + "'");
		switch (gitQuery) {
			case "branch": {
				const branch = repoInfo.branch ?? "";
				this.props.branch = branch;
				return branch as GitProp[TGitQuery];
			}
			case "commit": {
				const commit: string = repoInfo.sha ?? "";
				this.props.commit = commit;
				return commit as GitProp[TGitQuery];
			}
			case "unixTimestamp":
			case "isoTimestamp": {
				const dateString: string = repoInfo.authorDate ?? new Date().toISOString();
				const unixTimestamp = this.unixTimestamp;

				this.props.unixTimestamp = unixTimestamp;
				this.props.isoTimestamp = dateString;

				return this.props[gitQuery] as GitProp[TGitQuery];
			}
			case "latestTag": {
				const tag = repoInfo.lastTag ?? "";

				this.props.latestTag = tag;
				return tag as GitProp[TGitQuery];
			}
			default:
				throw `not implemented: ${gitQuery}`;
		}
	}
}
