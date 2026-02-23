-- Daily AI usage summary
select
  date_trunc('day', created_at) as day,
  endpoint,
  model,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(cost_estimate_usd) as total_cost_usd
from ai_usage
group by 1, 2, 3
order by day desc, endpoint;
