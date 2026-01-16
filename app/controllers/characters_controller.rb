class CharactersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_campaign
  before_action :set_character, only: [:edit, :update, :destroy]

  def new
    @character = @campaign.characters.new
    @character.pc = false if params[:pc] == "false"
  end

  def create
    @character = @campaign.characters.new(character_params)

    if @character.save
      redirect_to campaign_path(@campaign), notice: "Character created!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @character.update(character_params)
      redirect_to campaign_path(@campaign), notice: "Character updated!"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @character.destroy
    redirect_to campaign_path(@campaign), notice: "Character deleted!"
  end

  private

  def set_campaign
    @campaign = current_user.campaigns.find(params[:campaign_id])
  end

  def set_character
    @character = @campaign.characters.find(params[:id])
  end

  def character_params
    params.require(:character).permit(:name, :pc, :initiative_mod, :avatar)
  end
end
