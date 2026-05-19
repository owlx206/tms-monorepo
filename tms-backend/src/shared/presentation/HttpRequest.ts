export type HttpRequest<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
  TUser = unknown,
  TContext = unknown,
> = {
  body: TBody;
  params: TParams;
  query: TQuery;
  user?: TUser;
  context: TContext;
  headers: Record<string, string | string[] | undefined>;
};
