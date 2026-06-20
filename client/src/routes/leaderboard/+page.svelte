<script lang="ts">
  import Icon from '@iconify/svelte';

  export let data;

  $: isMonthly = data.period === 'month';
</script>

<svelte:head>
  <title>Leaderboard - Locful</title>
  <meta
    name="description"
    content="See the current Locful rewards leaderboard, including all-time leaders and this month’s active users."
  />
</svelte:head>

<section
  class="mb-8 flex flex-col gap-4 rounded-3xl border border-base-200 bg-base-100 p-8 shadow-lg md:flex-row md:items-end md:justify-between"
>
  <div>
    <p
      class="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
    >
      <Icon icon="material-symbols:leaderboard" class="h-5 w-5" />
      Rewards ranking
    </p>
    <h1 class="text-4xl font-black tracking-tight">Leaderboard</h1>
    <p class="mt-3 max-w-2xl text-base-content/70">
      Track the most active sellers and see how steady marketplace activity moves users up the
      rankings.
    </p>
  </div>
  <div class="join">
    <a href="/leaderboard?period=all" class:btn-primary={!isMonthly} class="btn join-item"
      >All-time</a
    >
    <a href="/leaderboard?period=month" class:btn-primary={isMonthly} class="btn join-item"
      >This month</a
    >
  </div>
</section>

<section class="grid gap-6 lg:grid-cols-[1fr_320px]">
  <div class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 class="card-title text-2xl">Top users</h2>
        <a href="/rewards" class="link link-primary text-sm font-medium">How points work</a>
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
      <h2 class="card-title">Ranking tips</h2>
      <ul class="mt-3 space-y-4 text-sm text-base-content/75">
        <li class="flex gap-3">
          <Icon icon="material-symbols:bolt" class="mt-0.5 h-5 w-5 text-primary" />
          Log in daily to keep your monthly rank moving.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:campaign" class="mt-0.5 h-5 w-5 text-primary" />
          Publish listings instead of leaving them in draft.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:refresh" class="mt-0.5 h-5 w-5 text-primary" />
          Republish expired listings when they are still relevant.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:person-check" class="mt-0.5 h-5 w-5 text-primary" />
          Complete your profile once for a one-time boost.
        </li>
      </ul>
      <div class="mt-6">
        <a href="/rewards" class="btn btn-outline w-full gap-2">
          <Icon icon="material-symbols:menu-book" class="h-5 w-5" />
          Read rewards guide
        </a>
      </div>
    </div>
  </aside>
</section>
