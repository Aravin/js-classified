<script lang="ts">
  import Icon from '@iconify/svelte';

  export let data;

  $: isMonthly = data.period === 'month';

  const rules = [
    'Log in daily — login points are granted once per calendar day.',
    'Publish listings — points are awarded when a draft becomes active, not when you save it.',
    'Republish expired listings when they are still relevant.',
    'Complete your profile once (email, phone, full name, avatar) for a one-time bonus.',
    'Switch between all-time and monthly views to track different rankings.',
  ];
</script>

<svelte:head>
  <title>Rewards & Leaderboard - Locful</title>
  <meta
    name="description"
    content="Learn how Locful rewards work, see point values, and track the all-time and monthly leaderboard."
  />
</svelte:head>

<section
  class="mb-10 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary to-secondary p-8 text-primary-content shadow-xl md:p-10"
>
  <div class="max-w-3xl">
    <div
      class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur"
    >
      <Icon icon="material-symbols:workspace-premium" class="h-5 w-5" />
      Rewards program
    </div>
    <h1 class="text-4xl font-black tracking-tight md:text-5xl">Earn points. Climb the ranks.</h1>
    <p class="mt-4 text-base text-primary-content/85 md:text-lg">
      Earn points for consistent, real marketplace activity. Your total points determine your place
      on the leaderboard.
    </p>
  </div>
</section>

<section id="leaderboard" class="mb-10 grid scroll-mt-24 gap-6 lg:grid-cols-[1fr_320px]">
  <div class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 class="card-title text-2xl">
          <Icon icon="material-symbols:leaderboard" class="h-6 w-6 text-primary" />
          Leaderboard
        </h2>
        <div class="join">
          <a
            href="/rewards?period=all#leaderboard"
            class:btn-primary={!isMonthly}
            class="btn join-item">All-time</a
          >
          <a
            href="/rewards?period=month#leaderboard"
            class:btn-primary={isMonthly}
            class="btn join-item">This month</a
          >
        </div>
      </div>

      {#if data.leaderboard.length === 0}
        <div class="rounded-2xl bg-base-200/60 p-8 text-center text-base-content/60">
          <Icon icon="material-symbols:trophy-outline" class="mx-auto mb-3 text-5xl" />
          <p class="text-lg font-semibold">No ranked users yet</p>
          <p class="mt-1 text-sm">The leaderboard will populate once rewards have been earned.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th class="text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {#each data.leaderboard as entry (entry.rank)}
                <tr>
                  <td>
                    <div class="flex items-center gap-2 font-bold">
                      {#if entry.rank <= 3}
                        <Icon icon="material-symbols:trophy" class="h-5 w-5 text-warning" />
                      {/if}
                      #{entry.rank}
                    </div>
                  </td>
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar placeholder">
                        <div class="h-10 w-10 rounded-full bg-primary/10 text-primary">
                          {#if entry.avatar}
                            <img
                              src={entry.avatar}
                              alt={entry.fullName?.trim() || entry.username?.trim() || 'User'}
                            />
                          {:else}
                            <span class="text-sm font-bold">
                              {(entry.fullName?.trim() ||
                                entry.username?.trim() ||
                                'U')[0]?.toUpperCase()}
                            </span>
                          {/if}
                        </div>
                      </div>
                      <div>
                        <p class="font-semibold">
                          {entry.fullName?.trim() || entry.username?.trim() || 'Locful User'}
                        </p>
                        <p class="text-xs text-base-content/60">
                          {entry.username?.trim() || 'Marketplace member'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="text-right text-lg font-black text-primary">{entry.points}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  <aside class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <h2 class="card-title text-xl">How to rank up</h2>
      <ul class="mt-3 space-y-4 text-sm text-base-content/75">
        {#each rules as rule (rule)}
          <li class="flex gap-3">
            <Icon icon="material-symbols:check-circle" class="mt-0.5 h-5 w-5 text-success" />
            {rule}
          </li>
        {/each}
      </ul>
      <div class="mt-6">
        <a href="#points" class="btn btn-outline w-full gap-2">
          <Icon icon="material-symbols:calculate" class="h-5 w-5" />
          Points table
        </a>
      </div>
    </div>
  </aside>
</section>

<section id="points" class="mb-10 scroll-mt-24">
  <div class="mb-4 flex items-center gap-2">
    <Icon icon="material-symbols:stars" class="h-6 w-6 text-primary" />
    <h2 class="text-2xl font-bold">Points table</h2>
  </div>
  <div class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Points</th>
              <th>Rule</th>
            </tr>
          </thead>
          <tbody>
            {#each data.rewards as reward (reward.title)}
              <tr>
                <td class="font-semibold">{reward.title}</td>
                <td>
                  <span class="badge badge-primary badge-lg">+{reward.points}</span>
                </td>
                <td class="text-base-content/70">{reward.description}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<section class="mb-10">
  <div class="mb-4 flex items-center gap-2">
    <Icon icon="material-symbols:calculate" class="h-6 w-6 text-primary" />
    <h2 class="text-2xl font-bold">Worked examples</h2>
  </div>
  <div class="grid gap-6 lg:grid-cols-3">
    {#each data.examples as example (example.title)}
      <article class="card border border-base-200 bg-base-100 shadow-lg">
        <div class="card-body">
          <h3 class="card-title">{example.title}</h3>
          <ul class="mt-3 space-y-3 text-sm text-base-content/75">
            {#each example.steps as step (step)}
              <li class="flex gap-3">
                <Icon
                  icon="material-symbols:subdirectory-arrow-right"
                  class="mt-0.5 h-4 w-4 text-primary"
                />
                {step}
              </li>
            {/each}
          </ul>
          <div class="mt-6 rounded-2xl bg-primary/10 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-primary">Example total</p>
            <p class="mt-1 text-3xl font-black text-primary">{example.totalPoints} pts</p>
          </div>
        </div>
      </article>
    {/each}
  </div>
</section>

<section class="card border border-base-200 bg-base-100 shadow-lg">
  <div class="card-body">
    <h2 class="card-title text-2xl">FAQ</h2>
    <div class="mt-4 space-y-5 text-sm leading-6 text-base-content/80">
      <div>
        <p class="font-semibold text-base-content">Why didn’t my draft earn points?</p>
        <p class="mt-1">
          Drafts are not rewarded. Points are only granted when the listing is published.
        </p>
      </div>
      <div>
        <p class="font-semibold text-base-content">Do I get login points every time I refresh?</p>
        <p class="mt-1">No. Login rewards are limited to one grant per day.</p>
      </div>
      <div>
        <p class="font-semibold text-base-content">How do I increase my rank fastest?</p>
        <p class="mt-1">
          Stay active consistently: complete your profile, publish useful listings, and republish
          expired ones when they are relevant again.
        </p>
      </div>
    </div>
  </div>
</section>
