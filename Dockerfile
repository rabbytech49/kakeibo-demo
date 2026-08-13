FROM node:22-slim

# node:22-slim には UID/GID 1000 の非rootユーザー "node" が既に存在するためそれを利用する
# （appuser を UID 1000 で新規作成すると衝突してビルドが失敗する）
ARG USERNAME=node

# システムパッケージの更新（git などよく使うものを入れておく）
# procps: ps / iproute2: ss（プロセス・待受ポートの確認用。READMEの「トラブルシューティング」参照）
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    procps \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Claude Code の設定ディレクトリを事前作成し、非rootユーザーの所有にする
# （名前付きボリュームの初回マウント時に root 所有になるのを防ぐ）
RUN mkdir -p /home/$USERNAME/.claude \
    && chown -R $USERNAME:$USERNAME /home/$USERNAME/.claude

# 作業ディレクトリを作成し、非rootユーザーの所有にする
WORKDIR /workspace
RUN chown -R $USERNAME:$USERNAME /workspace

# ここから先は非rootユーザーとして動作する
USER $USERNAME

# 依存ライブラリを先にコピーしてインストール（キャッシュが効きやすい）
COPY --chown=$USERNAME:$USERNAME package.json package-lock.json* ./
RUN npm install

# プロジェクトのコードをコピー（所有者を非rootユーザーに）
COPY --chown=$USERNAME:$USERNAME . .

# コンテナ起動時のデフォルト動作（一旦は待機）
CMD ["bash"]
