class User < ApplicationRecord
  has_many :campaigns, dependent: :destroy
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  def can_create_campaign?
    campaigns.count < 1
    #has_unlocked_campaigns?
  end

end
