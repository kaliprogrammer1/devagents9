import { agentMemory, skillManager, createUserMemory, summarizeForStorage, knowledgeGraph } from './agentMemory';
import { CodeExecutor, TestRunner } from './codeExecution';
import { GitHubIntegration } from './github';
import { hierarchicalPlanner } from './hierarchicalPlanning';
import { supabaseAdmin } from './supabase';

export interface AgentContext {
  userId: string;
  task: string;
  previousActions: string[];
  screenState?: {
    activeApp: string | null;
    browserUrl: string;
    visibleWindows: string[];
  };
}

export interface LearnedInsight {
  type: 'pattern' | 'solution' | 'error_fix' | 'optimization' | 'fact' | 'concept';
  content: string;
  importance: number;
  entities?: string[];
  relations?: Array<{ target: string; type: string }>;
}

export class AgentBrain {
  private userId: string;
  private userMemory: ReturnType<typeof createUserMemory>;
  private codeExecutor: CodeExecutor;
  private testRunner: TestRunner;
  private github: GitHubIntegration;
  
  constructor(userId: string) {
    this.userId = userId;
    this.userMemory = createUserMemory(userId);
    this.codeExecutor = new CodeExecutor(userId);
    this.testRunner = new TestRunner(userId);
    this.github = new GitHubIntegration(userId);
  }
  
  async think(context: AgentContext): Promise<{
    relevantMemories: string[];
    relevantSkills: string[];
    relevantKnowledgeNodes: any[];
    userPreferences: Record<string, unknown>;
    suggestedApproach: string;
    hierarchicalPlan?: string[];
  }> {
    const taskKeywords = context.task.toLowerCase().split(' ');
    
    const [universalMemories, userMemories, skills, preferences, graphNodes] = await Promise.all([
      agentMemory.searchUniversalMemory(context.task, 5),
      this.userMemory.searchMemories(context.task, 5),
      skillManager.searchSkills(context.task),
      this.userMemory.getAllPreferences(),
      knowledgeGraph.searchGraph(context.task),
    ]);
    
    const relevantMemories = [
      ...universalMemories.map(m => `[Universal] ${m.content}`),
      ...userMemories.map(m => `[User] ${m.content}`),
    ];
    
    const relevantSkills = [
      ...skills.map(s => `${s.skill_name}: ${s.description} (used ${s.usage_count}x, ${Math.round((s.success_rate || 0) * 100)}% success)`),
    ];

    // Expand context using Knowledge Graph
    const relevantKnowledgeNodes = [];
    for (const node of graphNodes) {
      const related = await knowledgeGraph.getRelatedNodes(node.id);
      relevantKnowledgeNodes.push({
        ...node,
        related: related.map(r => ({ type: r.relation, name: r.node.name }))
      });
    }
    
    // Use Hierarchical Planning (Tree of Thoughts) for complex tasks
    let hierarchicalPlan: string[] | undefined;
    if (context.task.length > 20 || taskKeywords.length > 4) {
      const taskContext = await this.getContextForTask(context.task, false);
      hierarchicalPlan = await hierarchicalPlanner.plan(context.task, {}, taskContext);
    }

    let suggestedApproach = 'Analyze the task and execute step by step.';
    // ... rest of the logic
    
    if (taskKeywords.some(k => ['code', 'write', 'program', 'function', 'script'].includes(k))) {
      suggestedApproach = 'Use code execution capabilities. Write code, test it, and iterate.';
    } else if (taskKeywords.some(k => ['github', 'repo', 'pr', 'commit', 'branch'].includes(k))) {
      suggestedApproach = 'Use GitHub integration. Check connection status first.';
    } else if (taskKeywords.some(k => ['search', 'find', 'browse', 'web'].includes(k))) {
      suggestedApproach = 'Use browser to search and gather information.';
    } else if (taskKeywords.some(k => ['remember', 'recall', 'history'].includes(k))) {
      suggestedApproach = 'Search memories and past interactions.';
    }
    
    return {
      relevantMemories,
      relevantSkills,
      userPreferences: preferences,
      suggestedApproach,
      hierarchicalPlan
    };
  }
  
  async learn(insights: LearnedInsight[]): Promise<void> {
    for (const insight of insights) {
      const summary = summarizeForStorage(insight.content, 500);
      await agentMemory.addUniversalMemory(insight.type, summary, insight.importance);
      
      // Add to Knowledge Graph
      const nodeId = await knowledgeGraph.addNode(
        insight.entities?.[0] || insight.content.substring(0, 50),
        insight.type,
        insight.content,
        { importance: insight.importance, entities: insight.entities }
      );
      
      if (nodeId && insight.relations) {
        for (const rel of insight.relations) {
          const targetNode = await knowledgeGraph.findNodeByName(rel.target);
          if (targetNode) {
            await knowledgeGraph.addEdge(nodeId, targetNode.id, rel.type);
          }
        }
      }
    }
  }
  
  async learnFromTask(task: string, actions: string[], outcome: 'success' | 'failure', notes?: string): Promise<void> {
    const content = `Task: ${task}\nActions: ${actions.join(' → ')}\nOutcome: ${outcome}${notes ? `\nNotes: ${notes}` : ''}`;
    
    await this.userMemory.addMemory(
      'task_history',
      content,
      { task, actions, outcome },
      outcome === 'success' ? 0.7 : 0.5
    );

    // Add task to Knowledge Graph
    const taskId = await knowledgeGraph.addNode(task, 'task', content, { outcome, actions });
    
    if (outcome === 'success' && actions.length > 2) {
      // Auto-patch skill set (Continuous Learning 2.0)
      const patternName = `Skill: ${task.split(' ').slice(0, 3).join(' ')}`;
      await supabaseAdmin.from('skill_patterns').insert({
        pattern_name: patternName,
        pattern_description: `Generated from successful task: ${task}`,
        successful_action_sequence: actions,
        trigger_condition: task,
        usage_count: 1,
        success_rate: 1.0
      });

      const patternContent = `Successful pattern for "${task}": ${actions.join(' → ')}`;
      await agentMemory.addUniversalMemory('pattern', patternContent, 0.6);

      // Add solution to Knowledge Graph and link to task
      const solutionId = await knowledgeGraph.addNode(patternName, 'solution', patternContent, { actions });
      if (taskId && solutionId) {
        await knowledgeGraph.addEdge(taskId, solutionId, 'solved_by');
      }
    }
  }
  
  async learnNewSkill(
    name: string,
    category: 'coding' | 'research' | 'communication' | 'analysis' | 'automation' | 'integration',
    description: string,
    examples: string[],
    bestPractices: string[]
  ): Promise<void> {
    await skillManager.learnSkill(name, category, description, {
      examples,
      bestPractices,
      learnedAt: new Date().toISOString(),
    });
  }
  
  async monitorAndFixGitHubBuilds(owner: string, repo: string): Promise<{ fixed: boolean; message: string }> {
    await this.github.initialize();
    if (!this.github.isConnected()) {
      return { fixed: false, message: 'GitHub not connected' };
    }
    
    const result = await this.github.monitorAndFixBuilds(owner, repo);
    
    if (result.message.includes('Found failing build')) {
      await this.recordSkillUsage('github_cicd_monitoring', true);
      // Logic for autonomous fix would go here - for now we return the findings
    }
    
    return result;
  }
  
  async executeCode(language: string, code: string): Promise<{ success: boolean; output: string; error?: string }> {
    const result = await this.codeExecutor.execute(language, code);
    
    if (result.success) {
      await this.recordSkillUsage('code_execution', true);
    } else {
      await agentMemory.addUniversalMemory(
        'error_fix',
        `Error in ${language}: ${result.error}\nCode snippet: ${code.substring(0, 200)}`,
        0.4
      );
    }
    
    return result;
  }
  
  async runTests(language: string, code: string, testCode: string): Promise<{
    passed: number;
    failed: number;
    total: number;
    output: string;
  }> {
    const result = await this.testRunner.runTests(language, code, testCode);
    
    await this.recordSkillUsage('testing', result.failed === 0);
    
    return {
      passed: result.passed,
      failed: result.failed,
      total: result.total_tests,
      output: result.output || '',
    };
  }
  
  async connectGitHub(token: string): Promise<boolean> {
    const success = await this.github.initialize(token);
    if (success) {
      await this.recordSkillUsage('github_integration', true);
    }
    return success;
  }
  
  async getGitHubRepos(): Promise<Array<{ name: string; full_name: string; description: string | null }>> {
    await this.github.initialize();
    if (!this.github.isConnected()) return [];
    
    const repos = await this.github.listRepositories();
    return repos.map(r => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
    }));
  }
  
  async createPR(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<{ success: boolean; prUrl?: string }> {
    await this.github.initialize();
    if (!this.github.isConnected()) {
      return { success: false };
    }
    
    const pr = await this.github.createPullRequest(owner, repo, title, head, base, body);
    if (pr) {
      await this.recordSkillUsage('pr_creation', true);
      return { success: true, prUrl: pr.html_url };
    }
    
    return { success: false };
  }
  
  async rememberUserPreference(key: string, value: unknown, context?: string): Promise<void> {
    await this.userMemory.setPreference(key, value, context);
  }
  
  async recallUserPreference(key: string): Promise<unknown | null> {
    return this.userMemory.getPreference(key);
  }
  
  async getContextForTask(task: string, includeRecursive: boolean = true): Promise<string> {
    const thinking = await this.think({ userId: this.userId, task, previousActions: [] });
    
    let context = '';
    
    if (thinking.relevantMemories.length > 0) {
      context += `\nRelevant memories:\n${thinking.relevantMemories.slice(0, 3).join('\n')}`;
    }
    
    if (thinking.relevantSkills.length > 0) {
      context += `\nRelevant skills:\n${thinking.relevantSkills.slice(0, 3).join('\n')}`;
    }
    
    if (Object.keys(thinking.userPreferences).length > 0) {
      context += `\nUser preferences: ${JSON.stringify(thinking.userPreferences)}`;
    }
    
    context += `\nSuggested approach: ${thinking.suggestedApproach}`;
    
    if (includeRecursive && thinking.hierarchicalPlan) {
      context += `\nHierarchical Plan (ToT):\n${thinking.hierarchicalPlan.join(' → ')}`;
    }
    
    return context;
  }
  
  async getMostUsedSkills(): Promise<Array<{ name: string; uses: number; successRate: number }>> {
    const skills = await skillManager.getMostUsedSkills(10);
    return skills.map(s => ({
      name: s.skill_name,
      uses: s.usage_count || 0,
      successRate: s.success_rate || 0,
    }));
  }
  
  async getAgentStats(): Promise<{
    totalSkills: number;
    totalMemories: number;
    topSkills: string[];
    recentLearnings: string[];
  }> {
    const [skills, memories] = await Promise.all([
      skillManager.getAllSkills(),
      agentMemory.getRecentMemories(5),
    ]);
    
    const sortedSkills = [...skills].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
    
    return {
      totalSkills: skills.length,
      totalMemories: memories.length,
      topSkills: sortedSkills.slice(0, 5).map(s => s.skill_name),
      recentLearnings: memories.map(m => m.content.substring(0, 100)),
    };
  }
}

export function createAgentBrain(userId: string): AgentBrain {
  return new AgentBrain(userId);
}

export async function initializeBaseSkills(): Promise<void> {
  const baseSkills = [
    {
      name: 'web_browsing',
      category: 'research' as const,
      description: 'Navigate websites, search for information, and extract data from web pages',
      knowledge: { patterns: ['NAVIGATE:url', 'TYPE:search_query', 'CLICK:element'] },
    },
    {
      name: 'code_execution',
      category: 'coding' as const,
      description: 'Write and execute code in multiple programming languages',
      knowledge: { languages: ['javascript', 'python', 'typescript'], patterns: ['write', 'test', 'debug'] },
    },
    {
      name: 'github_integration',
      category: 'integration' as const,
      description: 'Interact with GitHub repositories, create branches, and manage pull requests',
      knowledge: { actions: ['clone', 'branch', 'commit', 'push', 'pr'] },
    },
    {
      name: 'testing',
      category: 'coding' as const,
      description: 'Write and run automated tests for code',
      knowledge: { frameworks: ['jest', 'unittest', 'pytest'] },
    },
    {
      name: 'task_planning',
      category: 'analysis' as const,
      description: 'Break down complex tasks into manageable steps',
      knowledge: { patterns: ['analyze', 'plan', 'execute', 'verify'] },
    },
  ];
  
  for (const skill of baseSkills) {
    await skillManager.learnSkill(skill.name, skill.category, skill.description, skill.knowledge);
  }
}
