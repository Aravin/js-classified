<script lang="ts">
  import Icon from '@iconify/svelte';

  export let data;
</script>

<svelte:head>
  <title>Rewards Guide - Locful</title>
  <meta
    name="description"
    content="Learn how Locful rewards work, see point values, and review simple examples of how users climb the leaderboard."
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
      Rewards guide
    </div>
    <h1 class="text-4xl font-black tracking-tight md:text-5xl">How rewards work</h1>
    <p class="mt-4 text-base text-primary-content/85 md:text-lg">
      Earn points for consistent, real marketplace activity. Your total points determine your place
      on the leaderboard.
    </p>
  </div>
</section>

<section class="mb-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
  <div class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <h2 class="card-title text-2xl">Points table</h2>
      <div class="mt-4 overflow-x-auto">
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

  <div class="card border border-base-200 bg-base-100 shadow-lg">
    <div class="card-body">
      <h2 class="card-title text-2xl">Quick rules</h2>
      <ul class="mt-4 space-y-4 text-sm leading-6 text-base-content/80">
        <li class="flex gap-3">
          <Icon icon="material-symbols:check-circle" class="mt-0.5 h-5 w-5 text-success" />
          Daily login points are limited to one reward per calendar day.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:check-circle" class="mt-0.5 h-5 w-5 text-success" />
          New-listing points are awarded when a draft becomes active, not when you save a draft.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:check-circle" class="mt-0.5 h-5 w-5 text-success" />
          Profile completion is a one-time reward when your email, phone, full name, and avatar are all
          filled in.
        </li>
        <li class="flex gap-3">
          <Icon icon="material-symbols:check-circle" class="mt-0.5 h-5 w-5 text-success" />
          Leaderboards show both all-time performance and this month’s activity.
        </li>
      </ul>
      <div class="mt-6">
        <a href="/leaderboard" class="btn btn-primary w-full gap-2">
          <Icon icon="material-symbols:leaderboard" class="h-5 w-5" />
          View leaderboard
        </a>
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
