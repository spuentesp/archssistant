# Use the official Node.js 18 image as a base
FROM mcr.microsoft.com/devcontainers/node:18

# [Optional] Install additional OS packages
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Install global node packages
# RUN npm install -g <your-package-list-here>

# Set the default shell to bash
SHELL ["/bin/bash", "-c"]

# [Optional] Expose port 3000 (or your app's port)
EXPOSE 3000

# [Optional] Set the default command
CMD ["npm", "start"]
