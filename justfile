default:
  @just --list

install:
  pnpm install
  dotnet restore planner.sln

test:
  pnpm test
  dotnet test planner.sln
