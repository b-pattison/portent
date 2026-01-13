class CampaignsController < ApplicationController
  before_action :authenticate_user!

  def index
    @campaigns = current_user.campaigns.to_a
    @campaign  = current_user.campaigns.new
  end

  def new
    @campaign = current_user.campaigns.build
  end
  
  def create
    if !current_user.can_create_campaign?
      redirect_to campaigns_path, alert: "Upgrade to create more campaigns."
      return
    end

    @campaigns = current_user.campaigns.to_a
    @campaign  = current_user.campaigns.new(campaign_params)

    if @campaign.save
      redirect_to campaigns_path, notice: "Campaign created!"
    else
      render :index, status: :unprocessable_entity
    end
  end

  def show
    @campaign = current_user.campaigns.find(params[:id])
  end

  private

  def campaign_params
    params.require(:campaign).permit(:name)
  end
end
